#!/usr/bin/env python3
"""
WilayaDZ — service de comptes et de synchronisation.

Rien que la bibliotheque standard de Python : pas de pip, pas de
requirements.txt, pas de chaine d'approvisionnement a surveiller. Le
tout tient dans un fichier lisible d'un bout a l'autre, ce qui est le
seul moyen honnete d'auditer soi-meme du code qui manipule des mots de
passe.

Le compte est obligatoire pour se servir de l'application : c'est lui
qui porte la progression d'un appareil a l'autre. Il n'est exige qu'UNE
fois, a l'ouverture du compte ou a la connexion — ensuite la session
reste sur l'appareil et tout continue de fonctionner hors ligne (PWA
installee, APK Android), la synchronisation reprenant au retour du
reseau.

Il ne s'expose jamais directement : nginx (conteneur wilaya-web) est
seul a pouvoir l'atteindre, lui-meme derriere le tunnel Cloudflare.
C'est ce qui rend `http.server` acceptable ici — il ne voit jamais
l'internet hostile en direct.
"""

import hashlib
import hmac
import json
import os
import re
import secrets
import smtplib
import sqlite3
import urllib.parse
import urllib.request
import threading
import time
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DB_PATH = os.environ.get("WILAYA_DB", "/data/wilayadz.sqlite3")
PORT = int(os.environ.get("PORT", "8090"))

# Une progression complete (69 wilayas + confusions) pese quelques Kio.
# 512 Kio laissent enormement de marge tout en bornant ce qu'un client
# peut nous faire avaler d'un coup.
MAX_BODY = 512 * 1024

# Au-dela de cette taille on ne prend meme plus la peine de vider le
# corps pour repondre poliment : on ferme.
DRAIN_LIMIT = 8 * 1024 * 1024

# Une session dort 180 jours avant d'etre oubliee. L'app sert a reviser
# par a-coups : exiger une reconnexion mensuelle serait une punition.
SESSION_TTL = 180 * 86400

# scrypt : ~16 Mio et ~60 ms par tentative sur le processeur de bigpc.
# Assez lent pour rendre une attaque par dictionnaire penible, assez
# rapide pour ne pas faire attendre quelqu'un qui se connecte.
SCRYPT_N, SCRYPT_R, SCRYPT_P = 1 << 14, 8, 1
SCRYPT_MAXMEM = 64 * 1024 * 1024

# Volontairement plus stricte que la norme : les caracteres qui ne
# servent qu'a fabriquer du HTML (< > " ') n'ont rien a faire dans une
# adresse, et les refuser ici evite d'avoir a s'en remettre au seul
# echappement de l'interface. Le reste du jeu autorise est celui des
# adresses reelles.
EMAIL_RE = re.compile(
    r"^[A-Za-z0-9!#$%&*+/=?^_`{|}~.-]+@[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?"
    r"(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$")
MIN_PASSWORD = 8
# Un pseudo, pas un prenom : on se choisit un nom dans cette
# application, on ne decline pas son identite. 24 caracteres laissent la
# place a un vrai pseudo sans qu'il deborde des avatars et des listes.
MAX_NAME = 24

# Le jeu de caracteres exact de secrets.token_urlsafe. Un jeton qui n'y
# repond pas n'a pas pu etre emis ici : c'est un refus, pas une erreur —
# et le verifier evite qu'un en-tete Authorization fantaisiste (un
# accent suffit) ne fasse lever token_fingerprint.
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{16,128}$")

# Une heure pour aller relever ses mails et cliquer : assez long pour ne
# pas etre une course, assez court pour qu'un lien oublie dans une boite
# ne serve a personne des semaines plus tard.
RESET_TTL = 3600

# Une journee pour confirmer son adresse : on ne releve pas forcement ses
# mails dans l'heure, et c'est le tout premier geste — echouer la ferait
# recommencer toute l'inscription.
CONFIRM_TTL = 24 * 3600

# Une inscription jamais confirmee finit par liberer l'adresse : sans
# cela, une faute de frappe sur le courriel de quelqu'un d'autre bloque
# cette adresse pour toujours.
UNVERIFIED_TTL = 7 * 86400

# Envoi des courriels. Sans SMTP_HOST le service n'envoie rien et se
# contente de journaliser le lien : c'est ce qui permet d'eprouver tout
# le mecanisme (jetons, expiration, ecrans) sans serveur de mail.
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "25"))
# L'adresse doit etre celle sous laquelle le relais s'authentifie
# reellement. Un expediteur en @smnc.win serait invérifiable — la zone
# n'a ni SPF ni DMARC — et un courriel de reinitialisation qui tombe
# dans les indesirables ne sert a rien du tout. Changer d'expediteur
# demande d'abord de publier SPF et DKIM pour le domaine choisi.
MAIL_FROM = os.environ.get("MAIL_FROM", "WilayaDZ <bigpc.alg@gmail.com>")
APP_URL = os.environ.get("APP_URL", "https://wilayadz.smnc.win")

# Identifiant client OAuth Google. Vide = le bouton « Continuer avec
# Google » n'apparait simplement pas : rien a reconstruire le jour ou on
# le renseigne, l'application demande la configuration au demarrage.
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

# Google verifie le jeton pour nous, sur son propre point d'entree. On
# evite ainsi d'embarquer une bibliotheque de cryptographie pour
# verifier une signature RS256 — le service reste sans dependance.
GOOGLE_TOKENINFO = "https://oauth2.googleapis.com/tokeninfo?id_token="
GOOGLE_TIMEOUT = 10

SCHEMA_VERSION = 3


# --------------------------------------------------------------------
# Base de donnees
# --------------------------------------------------------------------

class Store:
    """
    Une seule connexion SQLite partagee, protegee par un verrou.

    A l'echelle de ce service (quelques dizaines de comptes, une requete
    de synchronisation par session de revision), un pool de connexions
    serait de la complexite sans contrepartie. Le verrou garantit qu'on
    ne rencontre jamais le comportement non defini de SQLite entre
    threads, et WAL evite qu'une lecture bloque une ecriture.
    """

    def __init__(self, path):
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        self._lock = threading.Lock()
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        with self._lock:
            self._db.execute("PRAGMA journal_mode=WAL")
            self._db.execute("PRAGMA foreign_keys=ON")
            self._db.execute("PRAGMA busy_timeout=5000")
            self._migrate()

    def _migrate(self):
        version = self._db.execute("PRAGMA user_version").fetchone()[0]
        if version < 1:
            self._db.executescript(
                """
                CREATE TABLE IF NOT EXISTS accounts (
                  id       INTEGER PRIMARY KEY,
                  email    TEXT    NOT NULL UNIQUE,
                  name     TEXT    NOT NULL,
                  pw_salt  BLOB    NOT NULL,
                  pw_hash  BLOB    NOT NULL,
                  created  INTEGER NOT NULL,
                  version  INTEGER NOT NULL DEFAULT 0,
                  updated  INTEGER NOT NULL DEFAULT 0,
                  data     TEXT    NOT NULL DEFAULT ''
                );
                CREATE TABLE IF NOT EXISTS sessions (
                  token_hash BLOB    PRIMARY KEY,
                  account_id INTEGER NOT NULL
                             REFERENCES accounts(id) ON DELETE CASCADE,
                  created    INTEGER NOT NULL,
                  last_seen  INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS sessions_account
                  ON sessions(account_id);
                """
            )
            self._db.execute("PRAGMA user_version=1")
            self._db.commit()
        if version < 2:
            self._db.executescript(
                """
                CREATE TABLE IF NOT EXISTS resets (
                  token_hash BLOB    PRIMARY KEY,
                  account_id INTEGER NOT NULL
                             REFERENCES accounts(id) ON DELETE CASCADE,
                  created    INTEGER NOT NULL,
                  expires    INTEGER NOT NULL,
                  used       INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS resets_account ON resets(account_id);
                """
            )
            self._db.execute("PRAGMA user_version=2")
            self._db.commit()
        if version < 3:
            self._db.executescript(
                """
                ALTER TABLE accounts
                  ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;
                CREATE TABLE IF NOT EXISTS confirms (
                  token_hash BLOB    PRIMARY KEY,
                  account_id INTEGER NOT NULL
                             REFERENCES accounts(id) ON DELETE CASCADE,
                  created    INTEGER NOT NULL,
                  expires    INTEGER NOT NULL,
                  used       INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS confirms_account ON confirms(account_id);
                -- Les comptes ouverts avant que la confirmation existe sont
                -- consideres confirmes : ils n'ont jamais eu l'occasion de
                -- l'etre, les enfermer dehors serait les punir d'un choix
                -- qui n'etait pas le leur.
                UPDATE accounts SET verified = 1;
                """
            )
            self._db.execute("PRAGMA user_version=3")
            self._db.commit()

    def query(self, sql, args=()):
        with self._lock:
            return self._db.execute(sql, args).fetchall()

    def one(self, sql, args=()):
        rows = self.query(sql, args)
        return rows[0] if rows else None

    def write(self, sql, args=()):
        with self._lock:
            cur = self._db.execute(sql, args)
            self._db.commit()
            return cur

    def prune_sessions(self):
        self.write("DELETE FROM sessions WHERE last_seen < ?",
                   (int(time.time()) - SESSION_TTL,))

    def prune_resets(self):
        self.write("DELETE FROM resets WHERE expires < ?", (int(time.time()),))
        self.write("DELETE FROM confirms WHERE expires < ?", (int(time.time()),))

    def prune_unverified(self):
        """Une inscription abandonnee ne doit pas retenir l'adresse
        indefiniment — surtout si c'est celle de quelqu'un d'autre,
        saisie par erreur."""
        self.write("DELETE FROM accounts WHERE verified = 0 AND created < ?",
                   (int(time.time()) - UNVERIFIED_TTL,))


# --------------------------------------------------------------------
# Mots de passe et jetons
# --------------------------------------------------------------------

def hash_password(password, salt):
    return hashlib.scrypt(password.encode("utf-8"), salt=salt,
                          n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P,
                          dklen=32, maxmem=SCRYPT_MAXMEM)


def verify_password(password, salt, expected):
    return hmac.compare_digest(hash_password(password, salt), expected)


def new_token():
    """Le jeton en clair ne quitte jamais cette fonction que vers son
    proprietaire : la base n'en garde qu'une empreinte, de sorte qu'une
    copie du fichier SQLite ne permette de se faire passer pour
    personne."""
    raw = secrets.token_urlsafe(32)
    return raw, hashlib.sha256(raw.encode("ascii")).digest()


def token_fingerprint(raw):
    return hashlib.sha256(raw.encode("ascii")).digest()


# --------------------------------------------------------------------
# Courriel
# --------------------------------------------------------------------

def build_mail(subject, name, link, textes):
    """
    Le message part en francais ET en arabe, comme tout le reste de
    l'application : on ne sait pas laquelle des deux langues la personne
    lit, et ces messages arrivent justement au moment ou elle est
    bloquee dehors.

    Texte brut d'abord, HTML ensuite : un client qui n'affiche que le
    premier doit rester parfaitement utilisable — le lien y figure en
    clair, jamais cache derriere un libelle.
    """
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = MAIL_FROM
    # Sans Date ni Message-ID, le message part avec « message-id=<> » et
    # nombre de filtres anti-spam le penalisent — au pire moment, celui
    # ou quelqu'un ne peut pas entrer dans son compte.
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="wilayadz.smnc.win")
    msg["Auto-Submitted"] = "auto-generated"

    msg.set_content(
        "Bonjour %s,\n\n%s\n\n%s\n\n%s\n\n— WilayaDZ\n\n"
        "----------------------------------------\n\n"
        "مرحبا %s،\n\n%s\n\n%s\n\n%s\n\n— WilayaDZ\n"
        % (name, textes["fr_intro"], link, textes["fr_note"],
           name, textes["ar_intro"], link, textes["ar_note"])
    )

    # Le lien est place tel quel dans un href : il ne contient que des
    # caracteres de token_urlsafe et l'URL du site, jamais de saisie
    # d'utilisateur. Le prenom, lui, est echappe.
    safe = (name.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace('"', "&quot;"))
    bouton = ("padding:12px 18px;border-radius:10px;text-decoration:none;"
              "display:inline-block;font-weight:700;"
              "background:#9C5015;color:#F2E4CE")
    msg.add_alternative(
        "<div style=\"font-family:system-ui,sans-serif;max-width:520px;"
        "margin:0 auto;color:#2A2118\">"
        "<p style=\"font-size:1.25rem;font-weight:700;color:#9C5015\">WilayaDZ</p>"
        "<p>Bonjour %s,</p><p>%s</p>"
        "<p><a href=\"%s\" style=\"%s\">%s</a></p>"
        "<p style=\"font-size:.85rem;color:#6A5A44\">%s</p>"
        "<hr style=\"border:none;border-top:1px solid #E3D5BE\">"
        "<div dir=\"rtl\" lang=\"ar\">"
        "<p>مرحبا %s،</p><p>%s</p>"
        "<p><a href=\"%s\" style=\"%s\">%s</a></p>"
        "<p style=\"font-size:.85rem;color:#6A5A44\">%s</p>"
        "</div></div>"
        % (safe, textes["fr_intro"], link, bouton, textes["fr_cta"], textes["fr_note"],
           safe, textes["ar_intro"], link, bouton, textes["ar_cta"], textes["ar_note"]),
        subtype="html")
    return msg


def reset_mail(name, link):
    return build_mail(
        "WilayaDZ — nouveau mot de passe / كلمة سر جديدة", name, link, {
            "fr_intro": "Tu as demande un nouveau mot de passe pour ton compte "
                        "WilayaDZ. Ouvre ce lien (valable une heure) :",
            "fr_cta": "Choisir un mot de passe",
            "fr_note": "Si tu n'as rien demande, ignore ce message : rien n'a "
                       "change, et ta progression reste intacte.",
            "ar_intro": "لقد طلبت كلمة سر جديدة لحسابك في WilayaDZ. "
                        "افتح هذا الرابط (صالح لمدة ساعة):",
            "ar_cta": "اختر كلمة سر",
            "ar_note": "إن لم تطلب شيئا، تجاهل هذه الرسالة: لم يتغير شيء، وتقدّمك سليم.",
        })


def confirm_mail(name, link):
    return build_mail(
        "WilayaDZ — confirme ton adresse / أكّد بريدك", name, link, {
            "fr_intro": "Bienvenue ! Il reste une chose a faire : confirmer "
                        "que cette adresse est bien la tienne. Ouvre ce lien "
                        "(valable 24 heures) et tu seras connecte :",
            "fr_cta": "Confirmer mon adresse",
            "fr_note": "Si tu n'as pas ouvert de compte WilayaDZ, ignore ce "
                       "message : sans cette confirmation, le compte ne "
                       "servira a personne et sera efface.",
            "ar_intro": "مرحبا بك! بقي شيء واحد: تأكيد أن هذا البريد بريدك. "
                        "افتح هذا الرابط (صالح 24 ساعة) وستدخل مباشرة:",
            "ar_cta": "أكّد بريدي",
            "ar_note": "إن لم تفتح حسابا في WilayaDZ، تجاهل هذه الرسالة: بدون "
                       "هذا التأكيد لن يفيد الحساب أحدا وسيُحذف.",
        })


def send_mail(to_address, msg):
    """
    Renvoie True si le message est parti. Un echec d'envoi ne doit
    JAMAIS remonter au client : sinon la reponse de « mot de passe
    oublie » differerait selon que l'adresse existe ou non, et cette
    porte deviendrait un moyen de savoir qui a un compte ici.
    """
    msg["To"] = to_address
    if not SMTP_HOST:
        return False
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
            smtp.send_message(msg)
        # Le sujet, jamais l'adresse : les journaux de bigpc ne doivent
        # pas accumuler les adresses des gens.
        print("courriel envoye (%s)" % msg["Subject"].split("—")[-1].strip(),
              flush=True)
        return True
    except Exception as exc:
        # Ni l'adresse ni le contenu dans les journaux.
        print("echec d'envoi du mail : %s" % type(exc).__name__, flush=True)
        return False


# --------------------------------------------------------------------
# Limitation de debit
# --------------------------------------------------------------------

class RateLimiter:
    """Fenetre glissante en memoire. Elle protege la creation de compte
    et la connexion — les deux seules portes ou deviner quelque chose
    rapporte quelque chose."""

    def __init__(self):
        self._lock = threading.Lock()
        self._hits = {}

    def over(self, key, limit, window):
        """Le compteur est-il atteint ? Ne consomme rien — sert a
        verifier un quota d'echecs sans que la simple verification
        compte comme une tentative."""
        now = time.time()
        with self._lock:
            times = [t for t in self._hits.get(key, []) if now - t < window]
            self._hits[key] = times
            return len(times) >= limit

    def allow(self, key, limit, window):
        now = time.time()
        with self._lock:
            times = [t for t in self._hits.get(key, []) if now - t < window]
            if len(times) >= limit:
                self._hits[key] = times
                return False
            times.append(now)
            self._hits[key] = times
            if len(self._hits) > 4096:
                self._hits = {
                    k: v for k, v in self._hits.items()
                    if v and now - v[-1] < window
                }
            return True


# --------------------------------------------------------------------
# Validation
# --------------------------------------------------------------------

def clean_email(value):
    email = str(value or "").strip().lower()
    if len(email) > 254 or not EMAIL_RE.match(email):
        return None
    return email


def clean_name(value):
    name = str(value or "").strip()
    name = re.sub(r"\s+", " ", name)
    if not name or len(name) > MAX_NAME:
        return None
    return name


def clean_payload(value):
    """La progression appartient au client : le serveur la range sans
    l'interpreter. Il verifie seulement que c'est bien du JSON a la
    forme attendue, pour ne jamais stocker d'octets qui rendraient
    l'application inutilisable au retour."""
    if not isinstance(value, dict):
        return None
    if value.get("v") != 1 or not isinstance(value.get("p"), dict):
        return None
    encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if len(encoded.encode("utf-8")) > MAX_BODY:
        return None
    return encoded


# --------------------------------------------------------------------
# Serveur HTTP
# --------------------------------------------------------------------

store = Store(DB_PATH)
limiter = RateLimiter()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "wilayadz"
    sys_version = ""

    # -- plomberie ---------------------------------------------------

    def log_message(self, fmt, *args):
        # Ni chemin complet ni corps : les journaux de bigpc ne doivent
        # jamais accumuler d'adresses e-mail.
        print("%s %s -> %s" % (self.command, self.path.split("?")[0], args[1]
                               if len(args) > 1 else "?"), flush=True)

    def _cors(self):
        # Origin `*` est sans danger ici parce que l'authentification
        # passe par un en-tete Authorization, jamais par un cookie :
        # une page tierce peut appeler l'API, elle ne detient aucun
        # jeton et n'obtient donc rien. C'est aussi ce qui permet a
        # l'APK Android (origine « null ») de se synchroniser.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers",
                         "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods",
                         "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Max-Age", "86400")

    _responded = False
    _head = False

    def _guarded(self, handler):
        """
        Un defaut dans une route doit produire une reponse, pas un
        silence. Sans cela l'exception remonte jusqu'a socketserver, qui
        ferme la connexion sans rien envoyer (le telephone voit une
        coupure reseau, pas une erreur) et deverse une trace complete —
        corps de requete compris — dans les journaux de bigpc.
        """
        try:
            handler()
        except Exception as exc:
            print("erreur %s sur %s %s" % (type(exc).__name__, self.command,
                                           self.path.split("?")[0]), flush=True)
            if not self._responded:
                try:
                    self._fail(500, "server_error")
                except Exception:
                    self.close_connection = True
            else:
                self.close_connection = True

    def _send(self, code, payload=None):
        self._responded = True
        body = b"" if payload is None else json.dumps(
            payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self._cors()
        self.end_headers()
        # En HEAD, Content-Length reste celui du corps qu'un GET aurait
        # renvoye : c'est tout l'interet de la methode.
        if body and not self._head:
            self.wfile.write(body)

    def _fail(self, code, error):
        # Un code stable, jamais de phrase : c'est l'application qui
        # sait dire les choses en francais et en arabe.
        self._send(code, {"error": error})

    def _body(self):
        """
        Lit le corps de la requete, toujours et avant toute reponse.

        En HTTP/1.1 la connexion est reutilisee : repondre sans avoir
        vide le corps laisse des octets dans le tuyau, que le serveur
        relit ensuite comme s'ils etaient la requete suivante. C'est
        pour cela que la lecture a lieu ici, en tete de chaque verbe, et
        non dans chaque route apres ses controles.

        Renvoie le JSON decode, None si le corps est absent ou
        illisible, et False si la reponse a deja ete envoyee (corps trop
        gros : on ne peut pas vider proprement un corps arbitraire, donc
        on ferme).
        """
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return None
        if length > MAX_BODY:
            # Refuser sans lire laisse le client ecrire dans une socket
            # fermee (« broken pipe » de son cote, aucune reponse lisible).
            # On vide donc le corps par blocs pour pouvoir repondre 413
            # proprement — sauf s'il est absurdement gros, auquel cas le
            # seul geste raisonnable est de fermer.
            if length <= DRAIN_LIMIT:
                remaining = length
                while remaining > 0:
                    chunk = self.rfile.read(min(65536, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
            else:
                self.close_connection = True
            self._fail(413, "too_large")
            return False
        if length <= 0:
            return None
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return None

    def _client(self):
        for header in ("CF-Connecting-IP", "X-Real-IP"):
            value = self.headers.get(header)
            if value:
                return value.strip()[:64]
        return self.client_address[0]

    def _bearer(self):
        auth = self.headers.get("Authorization") or ""
        if not auth.startswith("Bearer "):
            return None
        raw = auth[7:].strip()
        return raw if TOKEN_RE.match(raw) else None

    def _account(self):
        raw = self._bearer()
        if not raw:
            return None
        row = store.one(
            "SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id"
            " WHERE s.token_hash = ?", (token_fingerprint(raw),))
        if not row:
            return None
        now = int(time.time())
        if now - row["created"] > SESSION_TTL:
            store.write("DELETE FROM sessions WHERE token_hash = ?",
                        (token_fingerprint(raw),))
            return None
        store.write("UPDATE sessions SET last_seen = ? WHERE token_hash = ?",
                    (now, token_fingerprint(raw)))
        return row

    # -- routage -----------------------------------------------------

    def _route(self):
        path = self.path.split("?")[0].rstrip("/") or "/"
        if path.startswith("/api"):
            path = path[4:] or "/"
        return path

    def do_OPTIONS(self):
        self._responded = True
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self._cors()
        self.end_headers()

    def do_GET(self):
        self._guarded(self._do_get)

    def do_HEAD(self):
        # Mêmes en-têtes que GET, sans le corps. Sans cela une sonde de
        # supervision qui interroge en HEAD reçoit un 501 et conclut que
        # le service est en panne alors qu'il va très bien.
        self._head = True
        self._guarded(self._do_get)

    def do_POST(self):
        self._guarded(self._do_post)

    def do_PUT(self):
        self._guarded(self._do_put)

    def do_DELETE(self):
        self._guarded(self._do_delete)

    def _do_get(self):
        if self._body() is False:
            return
        path = self._route()
        if path == "/health":
            return self._send(200, {"ok": True})
        if path == "/config":
            # Ce que l'application a besoin de savoir avant d'afficher
            # quoi que ce soit. L'identifiant client OAuth n'est pas un
            # secret : il est public par construction.
            return self._send(200, {"google": GOOGLE_CLIENT_ID or None})
        if path == "/me":
            return self._me()
        if path == "/sync":
            return self._sync_pull()
        self._fail(404, "not_found")

    def _do_post(self):
        body = self._body()
        if body is False:
            return
        path = self._route()
        if path == "/auth/register":
            return self._register(body)
        if path == "/auth/login":
            return self._login(body)
        if path == "/auth/logout":
            return self._logout()
        if path == "/auth/password":
            return self._change_password(body)
        if path == "/auth/name":
            return self._change_name(body)
        if path == "/auth/google":
            return self._google(body)
        if path == "/auth/confirm":
            return self._confirm(body)
        if path == "/auth/resend":
            return self._resend(body)
        if path == "/auth/forgot":
            return self._forgot(body)
        if path == "/auth/reset":
            return self._reset(body)
        self._fail(404, "not_found")

    def _do_put(self):
        body = self._body()
        if body is False:
            return
        if self._route() == "/sync":
            return self._sync_push(body)
        self._fail(404, "not_found")

    def _do_delete(self):
        body = self._body()
        if body is False:
            return
        if self._route() == "/account":
            return self._delete_account(body)
        self._fail(404, "not_found")

    # -- comptes -----------------------------------------------------

    def _public(self, row):
        return {"email": row["email"], "name": row["name"],
                "created": row["created"], "version": row["version"],
                "updated": row["updated"], "verified": bool(row["verified"])}

    def _issue_confirm(self, account_id, email, name):
        raw, digest = new_token()
        now = int(time.time())
        store.write(
            "INSERT INTO confirms (token_hash, account_id, created, expires)"
            " VALUES (?,?,?,?)", (digest, account_id, now, now + CONFIRM_TTL))
        # Meme raisonnement que pour la reinitialisation : le jeton
        # voyage dans le FRAGMENT, qui n'est jamais envoye au serveur et
        # n'apparait donc dans aucun journal d'acces.
        link = APP_URL + "/#confirm=" + raw
        if not send_mail(email, confirm_mail(name, link)):
            if not SMTP_HOST:
                print("mail non configure — lien de confirmation : %s" % link,
                      flush=True)

    def _google(self, body):
        """
        Connexion par Google. Le jeton d'identite est verifie AUPRES DE
        GOOGLE plutot que localement : verifier une signature RS256
        demanderait une bibliotheque de cryptographie, et ce service
        tient a n'avoir aucune dependance.
        """
        if not isinstance(body, dict):
            return self._fail(400, "bad_request")
        if not GOOGLE_CLIENT_ID:
            return self._fail(503, "google_off")
        if not limiter.allow("google:" + self._client(), 20, 900):
            return self._fail(429, "too_many")

        credential = str(body.get("credential") or "")
        if not credential or len(credential) > 4096:
            return self._fail(400, "bad_token")

        try:
            with urllib.request.urlopen(
                    GOOGLE_TOKENINFO + urllib.parse.quote(credential, safe=""),
                    timeout=GOOGLE_TIMEOUT) as res:
                info = json.loads(res.read().decode("utf-8"))
        except Exception as exc:
            print("verification Google impossible : %s" % type(exc).__name__,
                  flush=True)
            return self._fail(400, "bad_token")

        # Le controle qui compte : ce jeton a-t-il ete emis POUR nous ?
        # Sans lui, un jeton obtenu par n'importe quelle autre
        # application Google ouvrirait un compte ici.
        if not hmac.compare_digest(str(info.get("aud") or ""), GOOGLE_CLIENT_ID):
            return self._fail(400, "bad_token")
        if str(info.get("email_verified")).lower() not in ("true", "1"):
            return self._fail(400, "bad_token")

        # Le nonce lie ce jeton a la demande qu'on vient d'emettre.
        attendu = str(body.get("nonce") or "")
        if attendu and not hmac.compare_digest(str(info.get("nonce") or ""), attendu):
            return self._fail(400, "bad_token")

        email = clean_email(info.get("email"))
        if not email:
            return self._fail(400, "bad_email")
        name = clean_name(info.get("given_name") or info.get("name") or "") or "Toi"

        row = store.one("SELECT * FROM accounts WHERE email = ?", (email,))
        if row is None:
            # Google a deja verifie cette adresse : pas de courriel de
            # confirmation a envoyer, le compte est utilisable tout de
            # suite. Le mot de passe est un alea qu'aucune saisie ne peut
            # reproduire — on se connecte par Google, ou en passant par
            # « mot de passe oublie » pour s'en choisir un.
            now = int(time.time())
            cur = store.write(
                "INSERT INTO accounts (email, name, pw_salt, pw_hash, created, verified)"
                " VALUES (?,?,?,?,?,1)",
                (email, name, secrets.token_bytes(16), secrets.token_bytes(32), now))
            row = store.one("SELECT * FROM accounts WHERE id = ?", (cur.lastrowid,))
        elif not row["verified"]:
            # Une inscription par courriel restee en attente : Google
            # vient de prouver que l'adresse est bien la sienne.
            store.write("UPDATE accounts SET verified = 1 WHERE id = ?", (row["id"],))
            store.write("DELETE FROM confirms WHERE account_id = ?", (row["id"],))
            row = store.one("SELECT * FROM accounts WHERE id = ?", (row["id"],))

        token = self._open_session(row["id"])
        self._send(200, {"token": token, "account": self._public(row)})

    def _confirm(self, body):
        if not isinstance(body, dict):
            return self._fail(400, "bad_request")
        if not limiter.allow("confirm:" + self._client(), 20, 3600):
            return self._fail(429, "too_many")

        raw = str(body.get("token") or "")
        if not TOKEN_RE.match(raw):
            return self._fail(400, "bad_token")

        row = store.one(
            "SELECT token_hash, account_id FROM confirms"
            " WHERE token_hash = ? AND used = 0 AND expires > ?",
            (token_fingerprint(raw), int(time.time())))
        if row is None:
            return self._fail(400, "bad_token")

        store.write("UPDATE accounts SET verified = 1 WHERE id = ?",
                    (row["account_id"],))
        store.write("UPDATE confirms SET used = 1 WHERE token_hash = ?",
                    (row["token_hash"],))
        store.write("DELETE FROM confirms WHERE account_id = ? AND used = 0",
                    (row["account_id"],))

        # On ouvre la session dans la foulee : la personne vient de
        # prouver qu'elle releve cette boite, lui redemander de se
        # connecter juste apres n'apprendrait rien a personne.
        acc = store.one("SELECT * FROM accounts WHERE id = ?", (row["account_id"],))
        token = self._open_session(acc["id"])
        self._send(200, {"token": token, "account": self._public(acc)})

    def _resend(self, body):
        """Comme « mot de passe oublie » : TOUJOURS 204. Repondre
        differemment selon que l'adresse existe, ou qu'elle est deja
        confirmee, ferait de cette porte un moyen de savoir qui a un
        compte ici."""
        if not isinstance(body, dict):
            return self._fail(400, "bad_request")
        if not limiter.allow("resend:" + self._client(), 5, 3600):
            return self._send(204)

        email = clean_email(body.get("email"))
        row = store.one("SELECT * FROM accounts WHERE email = ?",
                        (email,)) if email else None
        if row is None or row["verified"]:
            return self._send(204)
        if not limiter.allow("resend-acc:%d" % row["id"], 3, 3600):
            return self._send(204)

        store.write("DELETE FROM confirms WHERE account_id = ? AND used = 0",
                    (row["id"],))
        self._issue_confirm(row["id"], row["email"], row["name"])
        self._send(204)

    def _open_session(self, account_id):
        raw, digest = new_token()
        now = int(time.time())
        store.write(
            "INSERT INTO sessions (token_hash, account_id, created, last_seen)"
            " VALUES (?,?,?,?)", (digest, account_id, now, now))
        return raw

    def _register(self, body):
        if not isinstance(body, dict):
            return self._fail(400, "bad_request")

        email = clean_email(body.get("email"))
        if not email:
            return self._fail(400, "bad_email")
        name = clean_name(body.get("name"))
        if not name:
            return self._fail(400, "bad_name")
        password = str(body.get("password") or "")
        if len(password) < MIN_PASSWORD:
            return self._fail(400, "weak_password")

        # La limite se mesure apres la validation : une faute de frappe
        # dans l'adresse ne doit pas consommer le quota d'une famille
        # qui cree plusieurs comptes sur le meme appareil. Elle reste
        # avant scrypt, qui est la seule operation couteuse ici.
        if not limiter.allow("reg:" + self._client(), 8, 3600):
            return self._fail(429, "too_many")

        salt = secrets.token_bytes(16)
        now = int(time.time())
        store.prune_unverified()

        # Une inscription laissee en plan ne doit pas retenir l'adresse :
        # on la remplace. Le compte n'ayant jamais ete confirme, il
        # n'appartenait encore a personne — rien a perdre. Un compte
        # CONFIRME, lui, est intouchable.
        existant = store.one("SELECT id, verified FROM accounts WHERE email = ?",
                             (email,))
        if existant and existant["verified"]:
            return self._fail(409, "email_taken")

        if existant:
            store.write(
                "UPDATE accounts SET name = ?, pw_salt = ?, pw_hash = ?, created = ?"
                " WHERE id = ?",
                (name, salt, hash_password(password, salt), now, existant["id"]))
            account_id = existant["id"]
            store.write("DELETE FROM confirms WHERE account_id = ?", (account_id,))
        else:
            try:
                cur = store.write(
                    "INSERT INTO accounts (email, name, pw_salt, pw_hash, created)"
                    " VALUES (?,?,?,?,?)",
                    (email, name, salt, hash_password(password, salt), now))
                account_id = cur.lastrowid
            except sqlite3.IntegrityError:
                return self._fail(409, "email_taken")

        # AUCUNE session n'est ouverte ici : tant que l'adresse n'est pas
        # confirmee, rien ne prouve qu'elle appartient a celui qui vient
        # de la saisir. Sans cela, une faute de frappe donnerait un
        # compte irrecuperable — le lien de mot de passe oublie partirait
        # vers une boite qui n'est pas la sienne.
        self._issue_confirm(account_id, email, name)
        self._send(202, {"pending": True, "email": email})

    def _login(self, body):
        if not isinstance(body, dict):
            return self._fail(400, "bad_request")
        client = self._client()

        # Deux compteurs, et c'est volontaire. Le premier borne le
        # martelage brut. Le second ne compte que les ECHECS : une
        # famille qui se connecte a tour de role sur le meme telephone
        # n'a aucune raison d'etre punie, alors que dix mots de passe
        # faux d'affilee, si.
        if not limiter.allow("log-try:" + client, 40, 900):
            return self._fail(429, "too_many")
        if limiter.over("log-bad:" + client, 10, 900):
            return self._fail(429, "too_many")

        email = clean_email(body.get("email"))
        password = str(body.get("password") or "")
        row = store.one("SELECT * FROM accounts WHERE email = ?",
                        (email,)) if email else None

        # Meme reponse, meme cout, que l'adresse existe ou non : sinon
        # cette porte devient un moyen de savoir qui a un compte ici.
        if row is None:
            hash_password(password or "x", b"decoy-salt-00000")
            limiter.allow("log-bad:" + client, 10, 900)
            return self._fail(401, "bad_credentials")
        if not verify_password(password, row["pw_salt"], row["pw_hash"]):
            limiter.allow("log-bad:" + client, 10, 900)
            return self._fail(401, "bad_credentials")

        # Le mot de passe est bon, mais l'adresse n'a jamais ete
        # confirmee : c'est bien la personne qui a saisi l'inscription,
        # pas forcement le proprietaire de la boite.
        if not row["verified"]:
            return self._fail(403, "not_verified")

        token = self._open_session(row["id"])
        self._send(200, {"token": token, "account": self._public(row)})

    def _logout(self):
        raw = self._bearer()
        if raw:
            store.write("DELETE FROM sessions WHERE token_hash = ?",
                        (token_fingerprint(raw),))
        self._send(204)

    def _me(self):
        row = self._account()
        if not row:
            return self._fail(401, "unauthorized")
        self._send(200, {"account": self._public(row)})

    def _change_name(self, body):
        """Le pseudo se change : il est choisi, pas subi. Il vit dans la
        base — c'est le compte qui le porte, pas l'appareil."""
        if not isinstance(body, dict):
            return self._fail(400, "bad_request")
        row = self._account()
        if not row:
            return self._fail(401, "unauthorized")
        if not limiter.allow("name:%d" % row["id"], 10, 3600):
            return self._fail(429, "too_many")

        name = clean_name(body.get("name"))
        if not name:
            return self._fail(400, "bad_name")
        store.write("UPDATE accounts SET name = ? WHERE id = ?", (name, row["id"]))
        acc = store.one("SELECT * FROM accounts WHERE id = ?", (row["id"],))
        self._send(200, {"account": self._public(acc)})

    def _change_password(self, body):
        if not isinstance(body, dict):
            return self._fail(400, "bad_request")
        row = self._account()
        if not row:
            return self._fail(401, "unauthorized")
        if not limiter.allow("pw:%d" % row["id"], 5, 900):
            return self._fail(429, "too_many")

        if not verify_password(str(body.get("current") or ""),
                               row["pw_salt"], row["pw_hash"]):
            return self._fail(401, "bad_credentials")
        nxt = str(body.get("next") or "")
        if len(nxt) < MIN_PASSWORD:
            return self._fail(400, "weak_password")

        salt = secrets.token_bytes(16)
        store.write("UPDATE accounts SET pw_salt = ?, pw_hash = ? WHERE id = ?",
                    (salt, hash_password(nxt, salt), row["id"]))
        # Changer de mot de passe doit fermer les autres appareils :
        # c'est le geste qu'on fait justement quand on en a perdu un.
        keep = token_fingerprint(self._bearer())
        store.write("DELETE FROM sessions WHERE account_id = ? AND token_hash != ?",
                    (row["id"], keep))
        self._send(204)

    def _forgot(self, body):
        """
        Repond TOUJOURS 204, quoi qu'il arrive — adresse inconnue, mal
        formee, quota atteint, serveur de mail en panne. Une reponse qui
        differerait ferait de cette porte un moyen de savoir qui a un
        compte ici, ce que personne n'a a apprendre en la poussant.
        """
        if not isinstance(body, dict):
            return self._fail(400, "bad_request")
        if not limiter.allow("forgot:" + self._client(), 5, 3600):
            return self._send(204)

        email = clean_email(body.get("email"))
        row = store.one("SELECT * FROM accounts WHERE email = ?",
                        (email,)) if email else None
        # Un compte jamais confirme n'a pas de mot de passe a recuperer :
        # c'est la confirmation qu'il lui faut, et « renvoyer le lien »
        # est la porte prevue pour cela.
        if row is None or not row["verified"]:
            return self._send(204)
        # Et personne ne doit pouvoir faire pleuvoir des mails sur la
        # boite de quelqu'un d'autre en rejouant le formulaire.
        if not limiter.allow("forgot-acc:%d" % row["id"], 3, 3600):
            return self._send(204)

        store.prune_resets()
        raw, digest = new_token()
        now = int(time.time())
        store.write(
            "INSERT INTO resets (token_hash, account_id, created, expires)"
            " VALUES (?,?,?,?)", (digest, row["id"], now, now + RESET_TTL))

        # Le jeton voyage dans le FRAGMENT de l'URL : un fragment n'est
        # jamais envoye au serveur, donc il ne se retrouve ni dans les
        # journaux d'acces, ni dans ceux d'un intermediaire.
        link = APP_URL + "/#reset=" + raw
        if not send_mail(row["email"], reset_mail(row["name"], link)):
            if not SMTP_HOST:
                print("mail non configure — lien : %s" % link, flush=True)
        self._send(204)

    def _reset(self, body):
        if not isinstance(body, dict):
            return self._fail(400, "bad_request")
        if not limiter.allow("reset:" + self._client(), 10, 3600):
            return self._fail(429, "too_many")

        raw = str(body.get("token") or "")
        if not TOKEN_RE.match(raw):
            return self._fail(400, "bad_token")
        password = str(body.get("password") or "")
        if len(password) < MIN_PASSWORD:
            return self._fail(400, "weak_password")

        row = store.one(
            "SELECT token_hash, account_id FROM resets"
            " WHERE token_hash = ? AND used = 0 AND expires > ?",
            (token_fingerprint(raw), int(time.time())))
        if row is None:
            return self._fail(400, "bad_token")

        salt = secrets.token_bytes(16)
        store.write("UPDATE accounts SET pw_salt = ?, pw_hash = ? WHERE id = ?",
                    (salt, hash_password(password, salt), row["account_id"]))
        store.write("UPDATE resets SET used = 1 WHERE token_hash = ?",
                    (row["token_hash"],))
        # On demande un nouveau mot de passe quand on craint que
        # quelqu'un d'autre soit entre : toutes les autres demandes en
        # cours et tous les appareils connectes doivent donc tomber.
        store.write("DELETE FROM resets WHERE account_id = ? AND used = 0",
                    (row["account_id"],))
        store.write("DELETE FROM sessions WHERE account_id = ?",
                    (row["account_id"],))

        # La personne vient de prouver qu'elle releve ces mails : lui
        # redemander de se connecter juste apres n'apprendrait rien a
        # personne et la renverrait sur un formulaire de plus.
        acc = store.one("SELECT * FROM accounts WHERE id = ?", (row["account_id"],))
        token = self._open_session(acc["id"])
        self._send(200, {"token": token, "account": self._public(acc)})

    def _delete_account(self, body):
        if not isinstance(body, dict):
            return self._fail(400, "bad_request")
        row = self._account()
        if not row:
            return self._fail(401, "unauthorized")
        if not verify_password(str(body.get("password") or ""),
                               row["pw_salt"], row["pw_hash"]):
            return self._fail(401, "bad_credentials")
        store.write("DELETE FROM accounts WHERE id = ?", (row["id"],))
        self._send(204)

    # -- synchronisation ---------------------------------------------

    def _sync_pull(self):
        row = self._account()
        if not row:
            return self._fail(401, "unauthorized")
        # Le pseudo voyage avec la synchronisation : il appartient au
        # COMPTE, pas a l'appareil. Sans cela, le changer ici laisserait
        # l'ancien nom affiche sur tous les autres telephones.
        self._send(200, {
            "version": row["version"],
            "updated": row["updated"],
            "name": row["name"],
            "data": json.loads(row["data"]) if row["data"] else None,
        })

    def _sync_push(self, body):
        if not isinstance(body, dict):
            return self._fail(400, "bad_request")
        row = self._account()
        if not row:
            return self._fail(401, "unauthorized")

        encoded = clean_payload(body.get("data"))
        if encoded is None:
            return self._fail(400, "bad_payload")

        base = body.get("base_version")
        if not isinstance(base, int):
            return self._fail(400, "bad_request")

        # Le client fusionne toujours avant de pousser. Si le serveur a
        # avance entre-temps, sa version ne correspond plus a celle sur
        # laquelle la fusion a ete faite : on refuse et on lui rend
        # l'etat courant pour qu'il refasse la fusion. Sans ce garde-fou,
        # deux appareils actifs le meme jour s'effaceraient l'un l'autre.
        if base != row["version"]:
            return self._send(409, {
                "error": "conflict",
                "version": row["version"],
                "updated": row["updated"],
                "data": json.loads(row["data"]) if row["data"] else None,
            })

        version = row["version"] + 1
        now = int(time.time())
        store.write(
            "UPDATE accounts SET data = ?, version = ?, updated = ? WHERE id = ?",
            (encoded, version, now, row["id"]))
        self._send(200, {"version": version, "updated": now})


def main():
    store.prune_sessions()
    store.prune_resets()
    store.prune_unverified()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.daemon_threads = True
    print("wilayadz-api : ecoute sur le port %d, base %s" % (PORT, DB_PATH),
          flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
