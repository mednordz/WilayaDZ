#!/usr/bin/env python3
"""
WilayaDZ — service de comptes et de synchronisation.

Rien que la bibliotheque standard de Python : pas de pip, pas de
requirements.txt, pas de chaine d'approvisionnement a surveiller. Le
tout tient dans un fichier lisible d'un bout a l'autre, ce qui est le
seul moyen honnete d'auditer soi-meme du code qui manipule des mots de
passe.

Ce service est un COMPLEMENT, jamais un prerequis : l'application
continue de fonctionner entierement hors ligne (PWA installee, APK
Android, file://). Le compte en ligne ne fait qu'une chose de plus —
porter la progression d'un appareil a l'autre sans code a recopier.

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
import sqlite3
import threading
import time
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
MAX_NAME = 18

# Le jeu de caracteres exact de secrets.token_urlsafe. Un jeton qui n'y
# repond pas n'a pas pu etre emis ici : c'est un refus, pas une erreur —
# et le verifier evite qu'un en-tete Authorization fantaisiste (un
# accent suffit) ne fasse lever token_fingerprint.
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{16,128}$")

SCHEMA_VERSION = 1


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
            self._db.execute("PRAGMA user_version=%d" % SCHEMA_VERSION)
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
# Limitation de debit
# --------------------------------------------------------------------

class RateLimiter:
    """Fenetre glissante en memoire. Elle protege la creation de compte
    et la connexion — les deux seules portes ou deviner quelque chose
    rapporte quelque chose."""

    def __init__(self):
        self._lock = threading.Lock()
        self._hits = {}

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
        if body:
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
                "updated": row["updated"]}

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
        try:
            cur = store.write(
                "INSERT INTO accounts (email, name, pw_salt, pw_hash, created)"
                " VALUES (?,?,?,?,?)",
                (email, name, salt, hash_password(password, salt), now))
        except sqlite3.IntegrityError:
            return self._fail(409, "email_taken")

        token = self._open_session(cur.lastrowid)
        row = store.one("SELECT * FROM accounts WHERE id = ?", (cur.lastrowid,))
        self._send(201, {"token": token, "account": self._public(row)})

    def _login(self, body):
        if not isinstance(body, dict):
            return self._fail(400, "bad_request")
        if not limiter.allow("log:" + self._client(), 10, 900):
            return self._fail(429, "too_many")

        email = clean_email(body.get("email"))
        password = str(body.get("password") or "")
        row = store.one("SELECT * FROM accounts WHERE email = ?",
                        (email,)) if email else None

        # Meme reponse, meme cout, que l'adresse existe ou non : sinon
        # cette porte devient un moyen de savoir qui a un compte ici.
        if row is None:
            hash_password(password or "x", b"decoy-salt-00000")
            return self._fail(401, "bad_credentials")
        if not verify_password(password, row["pw_salt"], row["pw_hash"]):
            return self._fail(401, "bad_credentials")

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
        self._send(200, {
            "version": row["version"],
            "updated": row["updated"],
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
