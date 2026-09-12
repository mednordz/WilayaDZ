#!/usr/bin/env python3
"""
Tests du service de comptes (server/app.py).

Lance une instance jetable sur un port libre, avec une base SQLite
temporaire, et l'exerce par HTTP reel — pas d'appel direct aux
fonctions : ce qui est verifie, c'est ce qu'un appareil verra.

    python3 tests/test_api.py
"""

import email as emaillib
import hashlib
import json
import os
import re
import socket
import socketserver
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAILURES = []
CHECKS = [0]


def check(label, condition, detail=""):
    CHECKS[0] += 1
    if condition:
        print("  ok   %s" % label)
    else:
        print("  FAIL %s %s" % (label, detail))
        FAILURES.append(label)


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


class MailSink(socketserver.ThreadingTCPServer):
    """
    Un serveur SMTP jetable, juste assez complet pour que smtplib lui
    parle. Sans lui on ne saurait pas si l'envoi lui-meme fonctionne —
    seulement que le service croit l'avoir tente.
    """
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, port):
        self.messages = []
        socketserver.ThreadingTCPServer.__init__(self, ("127.0.0.1", port),
                                                 MailSink.Session)

    class Session(socketserver.StreamRequestHandler):
        def handle(self):
            self.wfile.write(b"220 sink\r\n")
            body, in_data = [], False
            while True:
                line = self.rfile.readline()
                if not line:
                    return
                if in_data:
                    if line in (b".\r\n", b".\n"):
                        in_data = False
                        self.server.messages.append(b"".join(body).decode("utf-8", "replace"))
                        self.wfile.write(b"250 ok\r\n")
                        continue
                    body.append(line)
                    continue
                cmd = line.strip().upper()
                if cmd.startswith(b"EHLO") or cmd.startswith(b"HELO"):
                    self.wfile.write(b"250 sink\r\n")
                elif cmd.startswith(b"MAIL") or cmd.startswith(b"RCPT"):
                    self.wfile.write(b"250 ok\r\n")
                elif cmd.startswith(b"DATA"):
                    in_data = True
                    self.wfile.write(b"354 go\r\n")
                elif cmd.startswith(b"QUIT"):
                    self.wfile.write(b"221 bye\r\n")
                    return
                else:
                    self.wfile.write(b"250 ok\r\n")


class Api:
    def __init__(self, base):
        self.base = base

    def call(self, method, path, body=None, token=None, raw_auth=None, ip=None):
        data = None
        headers = {}
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = "Bearer " + token
        if raw_auth is not None:
            headers["Authorization"] = raw_auth
        # En production nginx impose X-Real-IP et le client ne peut pas
        # le choisir ; ici il sert a simuler des appareils distincts,
        # donc des compteurs de debit distincts.
        if ip is not None:
            headers["X-Real-IP"] = ip
        req = urllib.request.Request(self.base + path, data=data,
                                     headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                raw = res.read().decode("utf-8")
                return res.status, (json.loads(raw) if raw else None)
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8")
            return e.code, (json.loads(raw) if raw else None)


def texte_du_mail(brut):
    """Le message tel qu'un client de messagerie l'affiche. Le corps part
    en quoted-printable, qui coupe les longues lignes avec un « = »
    final et encode les accents : lire le message brut donnerait un
    jeton tronque et du texte illisible."""
    if not brut:
        return ""
    parsed = emaillib.message_from_string(brut)
    textes = []
    for part in parsed.walk():
        if part.get_content_maintype() == "text":
            charge = part.get_payload(decode=True)
            if charge:
                textes.append(charge.decode(part.get_content_charset() or "utf-8",
                                            "replace"))
    return "\n".join(textes)


def lien_du_mail(brut, genre):
    trouve = re.search(r"https://exemple\.test/#%s=([A-Za-z0-9_-]+)" % genre,
                       texte_du_mail(brut))
    return trouve.group(1) if trouve else None


def progress(**boxes):
    """Fabrique une charge utile a la forme exacte de celle que
    l'application produit (exportCode / packProfile)."""
    return {"v": 1, "n": "Amine", "x": 120, "sc": 3, "sl": "2026-09-11",
            "k": 1, "bb": 9, "cr": {}, "cf": {},
            "p": {code: [box, 10] for code, box in boxes.items()}}


def main():
    port = free_port()
    mail_port = free_port()
    tmp = tempfile.mkdtemp(prefix="wilayadz-test-")
    db = os.path.join(tmp, "test.sqlite3")

    sink = MailSink(mail_port)
    threading.Thread(target=sink.serve_forever, daemon=True).start()

    env = dict(os.environ, WILAYA_DB=db, PORT=str(port),
               SMTP_HOST="127.0.0.1", SMTP_PORT=str(mail_port),
               APP_URL="https://exemple.test")
    proc = subprocess.Popen([sys.executable, os.path.join(ROOT, "server", "app.py")],
                            env=env, stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL)
    api = Api("http://127.0.0.1:%d/api" % port)

    def wait_mail(before, seconds=10):
        end = time.time() + seconds
        while time.time() < end:
            if len(sink.messages) > before:
                return sink.messages[-1]
            time.sleep(0.1)
        return None

    try:
        for _ in range(50):
            try:
                if api.call("GET", "/health")[0] == 200:
                    break
            except Exception:
                time.sleep(0.1)
        else:
            raise SystemExit("le service n'a pas demarre")

        print("\nInscription : rien n'est acquis avant la confirmation")
        before = len(sink.messages)
        code, res = api.call("POST", "/auth/register",
                             {"email": "  Amine@Example.COM ", "name": "Amine",
                              "password": "correcthorse"})
        check("202 a l'inscription", code == 202, (code, res))
        check("AUCUN jeton tant que l'adresse n'est pas confirmee",
              not (res or {}).get("token"), res)
        check("l'adresse est normalisee",
              res["email"] == "amine@example.com", res["email"])

        mail = wait_mail(before)
        check("un mail de confirmation est parti", mail is not None)
        lisible = texte_du_mail(mail)
        check("c'est bien une confirmation, pas une reinitialisation",
              "confirmer que cette adresse est bien la tienne" in lisible
              and "nouveau mot de passe" not in lisible, lisible[:80])
        check("la confirmation est ecrite dans les deux langues",
              "Bienvenue" in lisible and "أكّد بريدي" in lisible)
        jeton_conf = lien_du_mail(mail, "confirm")
        check("le mail porte un lien de confirmation entier",
              jeton_conf is not None and len(jeton_conf) >= 40, jeton_conf)

        code, res = api.call("POST", "/auth/login",
                             {"email": "amine@example.com", "password": "correcthorse"})
        check("403 a la connexion tant que l'adresse n'est pas confirmee",
              code == 403 and res["error"] == "not_verified", (code, res))

        code, _ = api.call("POST", "/auth/forgot", {"email": "amine@example.com"})
        check("« mot de passe oublie » reste muet sur un compte non confirme",
              code == 204, code)
        check("et n'envoie rien", wait_mail(len(sink.messages), 2) is None)

        check("400 sur un jeton de confirmation fantaisiste",
              api.call("POST", "/auth/confirm", {"token": "pas!un!jeton"})[0] == 400)
        check("400 sur un jeton de confirmation inconnu",
              api.call("POST", "/auth/confirm", {"token": "z" * 43})[0] == 400)

        # Se reinscrire par-dessus une inscription JAMAIS confirmee doit
        # la remplacer : sinon une faute de frappe sur l'adresse de
        # quelqu'un d'autre bloquerait cette adresse pour toujours.
        before = len(sink.messages)
        code, res = api.call("POST", "/auth/register",
                             {"email": "amine@example.com", "name": "Amine",
                              "password": "correcthorse"})
        check("202 en se reinscrivant sur une adresse non confirmee", code == 202, code)
        jeton_conf2 = lien_du_mail(wait_mail(before), "confirm")
        check("un nouveau lien est envoye", jeton_conf2 is not None)
        check("l'ancien lien ne vaut plus rien",
              api.call("POST", "/auth/confirm", {"token": jeton_conf})[0] == 400)

        code, res = api.call("POST", "/auth/confirm", {"token": jeton_conf2})
        check("200 a la confirmation", code == 200, (code, res))
        check("une session est ouverte dans la foulee", bool(res and res.get("token")))
        check("le compte est marque confirme", res["account"]["verified"] is True, res)
        token = res["token"]
        check("le jeton de confirmation ne ressert pas",
              api.call("POST", "/auth/confirm", {"token": jeton_conf2})[0] == 400)
        check("la connexion marche maintenant",
              api.call("POST", "/auth/login",
                       {"email": "amine@example.com", "password": "correcthorse"})[0] == 200)

        code, res = api.call("POST", "/auth/register",
                             {"email": "amine@example.com", "name": "X",
                              "password": "correcthorse"})
        check("409 sur une adresse deja CONFIRMEE",
              code == 409 and res["error"] == "email_taken", code)

        print("\nValidation a l'inscription")
        code, res = api.call("POST", "/auth/register",
                             {"email": "pasunemail", "name": "X",
                              "password": "correcthorse"})
        check("400 sur adresse invalide", code == 400 and res["error"] == "bad_email", res)

        code, res = api.call("POST", "/auth/register",
                             {"email": "b@example.com", "name": "X", "password": "court"})
        check("400 sur mot de passe trop court",
              code == 400 and res["error"] == "weak_password", res)

        code, res = api.call("POST", "/auth/register",
                             {"email": "c@example.com", "name": "   ",
                              "password": "correcthorse"})
        check("400 sur nom vide", code == 400 and res["error"] == "bad_name", res)

        # Le rendu echappe deja tout, mais une adresse qui ne peut pas
        # exister n'a aucune raison d'entrer dans la base.
        for bad in ['<img src=x onerror=alert(1)>@e.com', 'a"b@e.com',
                    "a'b@e.com", 'a<b@e.com', 'a b@e.com', 'a@e', 'a@.com',
                    'a@e..com', '@e.com', 'a@-e.com']:
            code, res = api.call("POST", "/auth/register",
                                 {"email": bad, "name": "X", "password": "correcthorse"})
            check("adresse refusee : " + bad, code == 400 and res["error"] == "bad_email", code)

        for good in ['a.b+tag@example.co.uk', 'UPPER@Example.COM',
                     'x-y_z@sous-domaine.example.org']:
            code, res = api.call("POST", "/auth/register",
                                 {"email": good, "name": "X", "password": "correcthorse"})
            check("adresse acceptee : " + good, code == 202, (code, res))

        print("\nConnexion")
        code, res = api.call("POST", "/auth/login",
                             {"email": "amine@example.com", "password": "faux"})
        check("401 sur mauvais mot de passe",
              code == 401 and res["error"] == "bad_credentials", code)

        code, res = api.call("POST", "/auth/login",
                             {"email": "inconnu@example.com", "password": "faux"})
        check("401 identique sur compte inexistant",
              code == 401 and res["error"] == "bad_credentials", code)

        code, res = api.call("POST", "/auth/login",
                             {"email": "AMINE@example.com", "password": "correcthorse"})
        check("200 a la connexion", code == 200, code)
        second = res["token"]

        print("\nRenvoi du lien de confirmation")
        before = len(sink.messages)
        check("204 sur une adresse inconnue",
              api.call("POST", "/auth/resend", {"email": "personne@example.com"})[0] == 204)
        check("204 sur une adresse deja confirmee",
              api.call("POST", "/auth/resend", {"email": "amine@example.com"})[0] == 204)
        check("et aucun mail n'est parti dans ces deux cas",
              wait_mail(before, 2) is None)
        check("un second appareil recoit un autre jeton", second != token)

        print("\nAcces protege")
        check("401 sans jeton", api.call("GET", "/me")[0] == 401)
        check("401 avec jeton bidon", api.call("GET", "/me", token="n-importe-quoi")[0] == 401)

        # Un en-tete Authorization fantaisiste doit etre un refus poli,
        # jamais une erreur serveur : « é » suffisait a faire lever
        # token_fingerprint (encode("ascii")) avant qu'il soit filtre.
        for label, raw in [("un accent", "Bearer café"),
                           ("des caracteres interdits", "Bearer abc!def*"),
                           ("un jeton demesure", "Bearer " + "x" * 400),
                           ("un jeton vide", "Bearer "),
                           ("un autre schema", "Basic YWJjOmRlZg==")]:
            code, _ = api.call("GET", "/me", raw_auth=raw)
            check("401 sur " + label, code == 401, code)
        code, res = api.call("GET", "/me", token=token)
        check("200 avec jeton valide", code == 200 and res["account"]["name"] == "Amine", res)

        print("\nSynchronisation")
        code, res = api.call("GET", "/sync", token=token)
        check("un compte neuf n'a aucune donnee",
              code == 200 and res["data"] is None and res["version"] == 0, res)

        code, res = api.call("PUT", "/sync",
                             {"base_version": 0, "data": progress(**{"16": 4, "31": 2})},
                             token=token)
        check("premier envoi accepte", code == 200 and res["version"] == 1, res)

        code, res = api.call("GET", "/sync", token=second)
        check("le second appareil lit la progression",
              code == 200 and res["version"] == 1 and res["data"]["p"]["16"][0] == 4, res)

        print("\nConflit entre deux appareils")
        code, res = api.call("PUT", "/sync",
                             {"base_version": 1, "data": progress(**{"16": 5})},
                             token=second)
        check("le second appareil pousse sa fusion", code == 200 and res["version"] == 2, res)

        code, res = api.call("PUT", "/sync",
                             {"base_version": 1, "data": progress(**{"31": 3})},
                             token=token)
        check("409 quand la base a bouge", code == 409 and res["error"] == "conflict", code)
        check("le conflit renvoie l'etat courant",
              res["version"] == 2 and res["data"]["p"]["16"][0] == 5, res)

        code, res = api.call("PUT", "/sync",
                             {"base_version": 2, "data": progress(**{"16": 5, "31": 3})},
                             token=token)
        check("l'envoi refait sur la bonne base passe",
              code == 200 and res["version"] == 3, res)

        # Deux requêtes qui partent de la même version ne peuvent pas réussir ensemble.
        from concurrent.futures import ThreadPoolExecutor
        def simultaneous(_):
            return api.call("PUT", "/sync", {"base_version":3,"data":progress(**{"16":5,"31":3})}, token=token)
        with ThreadPoolExecutor(max_workers=2) as pool:
            races=list(pool.map(simultaneous,range(2)))
        check("une seule écriture concurrente est acceptée", sorted(r[0] for r in races)==[200,409],races)
        modern=dict(progress(**{"16":5,"31":3}),sv=2,ra=0)
        code,res=api.call("PUT","/sync",{"base_version":4,"data":modern},token=token)
        check("migration vers la sauvegarde datée",code==200,res)
        code,res=api.call("PUT","/sync",{"base_version":5,"data":progress()},token=token)
        check("ancien client ne retire pas les dates",code==409 and res["error"]=="client_update_required",res)
        modern["ra"]=100
        code,res=api.call("PUT","/sync",{"base_version":5,"data":modern},token=token)
        check("nouvelle génération acceptée",code==200,res)
        modern["ra"]=0
        code,res=api.call("PUT","/sync",{"base_version":6,"data":modern},token=token)
        check("ancienne génération ne ressuscite pas les données",code==409,res)
        with open(os.path.join(ROOT,"tests","payload_cases.json")) as fh:
            cases=json.load(fh)
        for case in cases:
            if case["valid"]: continue
            code,res=api.call("PUT","/sync",{"base_version":6,"data":case["payload"]},token=token)
            check("payload rejeté : "+case["name"],code==400,res)

        print("\nCharges utiles refusees")
        code, res = api.call("PUT", "/sync",
                             {"base_version": 3, "data": {"nimporte": "quoi"}}, token=token)
        check("400 sur charge utile mal formee",
              code == 400 and res["error"] == "bad_payload", res)

        code, res = api.call("PUT", "/sync", {"data": progress()}, token=token)
        check("400 sans base_version", code == 400, res)

        big = {"v": 1, "p": {str(i): [1, 1] for i in range(60000)}}
        code, res = api.call("PUT", "/sync", {"base_version": 3, "data": big}, token=token)
        check("413 sur charge utile geante", code == 413, code)
        # Un corps trop gros n'est jamais lu : si le service ne fermait
        # pas la connexion, ces octets seraient relus comme la requete
        # suivante et tout se desynchroniserait.
        check("le service repond encore apres un corps rejete",
              api.call("GET", "/me", token=token)[0] == 200)

        print("\nErreurs renvoyees avant lecture du corps")
        # Meme piege : refuser une requete authentifiee sans avoir vide
        # son corps laissait le tuyau dans un etat incoherent.
        check("401 sur /sync sans jeton, corps present",
              api.call("PUT", "/sync",
                       {"base_version": 0, "data": progress(**{"16": 1})})[0] == 401)
        check("le service repond encore apres un 401 sur corps present",
              api.call("GET", "/me", token=token)[0] == 200)

        print("\nInjection SQL")
        code, _ = api.call("POST", "/auth/login",
                           {"email": "x' OR '1'='1", "password": "x"})
        check("une adresse piegee ne connecte personne", code == 401, code)
        check("les comptes sont toujours la",
              api.call("GET", "/me", token=token)[0] == 200)

        print("\nChangement de pseudo")
        check("401 sans jeton",
              api.call("POST", "/auth/name", {"name": "Zoubir"})[0] == 401)
        check("400 sur un pseudo vide",
              api.call("POST", "/auth/name", {"name": "   "}, token=token)[0] == 400)
        check("400 sur un pseudo trop long",
              api.call("POST", "/auth/name", {"name": "z" * 25}, token=token)[0] == 400)

        code, res = api.call("POST", "/auth/name", {"name": "  Zoubir  "}, token=token)
        check("200 au changement", code == 200, (code, res))
        check("le pseudo est nettoye", res["account"]["name"] == "Zoubir", res)
        check("/me le confirme",
              api.call("GET", "/me", token=token)[1]["account"]["name"] == "Zoubir")

        # Le point qui compte : un AUTRE appareil doit le voir, sans quoi
        # le pseudo resterait celui de l'appareil et non celui du compte.
        code, res = api.call("GET", "/sync", token=second)
        check("un autre appareil voit le nouveau pseudo",
              res.get("name") == "Zoubir", res.get("name"))

        api.call("POST", "/auth/name", {"name": "Amine"}, token=token)

        print("\nChangement de mot de passe")
        code, res = api.call("POST", "/auth/password",
                             {"current": "faux", "next": "nouveaumotdepasse"},
                             token=token)
        check("401 si le mot de passe actuel est faux", code == 401, code)

        code, res = api.call("POST", "/auth/password",
                             {"current": "correcthorse", "next": "court"},
                             token=token)
        check("400 si le nouveau est trop court", code == 400, code)

        code, res = api.call("POST", "/auth/password",
                             {"current": "correcthorse", "next": "nouveaumotdepasse"},
                             token=token)
        check("204 au changement", code == 204, code)
        check("l'appareil qui a change reste connecte",
              api.call("GET", "/me", token=token)[0] == 200)
        check("les autres appareils sont deconnectes",
              api.call("GET", "/me", token=second)[0] == 401)
        check("l'ancien mot de passe ne marche plus",
              api.call("POST", "/auth/login",
                       {"email": "amine@example.com", "password": "correcthorse"})[0] == 401)
        code, res = api.call("POST", "/auth/login",
                             {"email": "amine@example.com", "password": "nouveaumotdepasse"})
        check("le nouveau mot de passe marche", code == 200, code)
        third = res["token"]

        print("\nDeconnexion")
        check("204 a la deconnexion",
              api.call("POST", "/auth/logout", token=third)[0] == 204)
        check("le jeton est mort", api.call("GET", "/me", token=third)[0] == 401)
        check("les autres appareils ne sont pas touches",
              api.call("GET", "/me", token=token)[0] == 200)

        print("\nLa progression survit a tout cela")
        code, res = api.call("GET", "/sync", token=token)
        check("la progression est intacte",
              code == 200 and res["version"] == 6 and res["data"]["p"]["16"][0] == 5, res)

        print("\nMot de passe oublie")
        before = len(sink.messages)
        code, _ = api.call("POST", "/auth/forgot", {"email": "personne@example.com"})
        check("204 sur une adresse inconnue", code == 204, code)
        check("aucun mail pour une adresse inconnue",
              wait_mail(before, 2) is None)

        before = len(sink.messages)
        code, _ = api.call("POST", "/auth/forgot", {"email": "AMINE@example.com"})
        check("204 sur une adresse connue", code == 204, code)
        mail = wait_mail(before)
        check("un mail est parti", mail is not None)

        # Decoder le message comme le ferait un vrai client : le corps
        # part en quoted-printable, qui coupe les longues lignes avec un
        # « = » final. Chercher le lien dans le message brut donnerait un
        # jeton tronque — ce qui n'arrive a personne dans sa boite mail,
        # mais fausserait completement ce test.
        parsed = emaillib.message_from_string(mail or "")
        textes = []
        for part in parsed.walk():
            if part.get_content_maintype() == "text":
                charge = part.get_payload(decode=True)
                if charge:
                    textes.append(charge.decode(part.get_content_charset() or "utf-8",
                                                "replace"))
        lisible = "\n".join(textes)
        check("le mail a bien deux parties (texte et HTML)", len(textes) == 2, len(textes))

        found = re.search(r"https://exemple\.test/#reset=([A-Za-z0-9_-]+)", lisible)
        check("le mail contient un lien de reinitialisation", found is not None)
        check("le lien porte un jeton entier",
              found is not None and len(found.group(1)) >= 40,
              found.group(1) if found else None)
        check("le mail est ecrit dans les deux langues",
              "nouveau mot de passe" in lisible and "كلمة سر جديدة" in lisible)
        check("le sujet est bilingue",
              "WilayaDZ" in (parsed["Subject"] or "")
              and "كلمة" in (emaillib.header.make_header(
                  emaillib.header.decode_header(parsed["Subject"] or "")).__str__()))
        reset_token = found.group(1) if found else "x" * 43

        check("400 sur un jeton fantaisiste",
              api.call("POST", "/auth/reset",
                       {"token": "pas!un!jeton", "password": "unautremotdepasse"})[0] == 400)
        check("400 sur un jeton inconnu",
              api.call("POST", "/auth/reset",
                       {"token": "z" * 43, "password": "unautremotdepasse"})[0] == 400)
        check("400 si le nouveau mot de passe est trop court",
              api.call("POST", "/auth/reset",
                       {"token": reset_token, "password": "court"})[0] == 400)

        # Un jeton perime doit etre refuse comme un inconnu. On l'ecrit
        # directement dans la base : attendre une heure n'est pas un test.
        raw_old = "o" * 43
        conn = sqlite3.connect(db)
        acc_id = conn.execute("SELECT id FROM accounts WHERE email = ?",
                              ("amine@example.com",)).fetchone()[0]
        conn.execute("INSERT INTO resets (token_hash, account_id, created, expires)"
                     " VALUES (?,?,?,?)",
                     (hashlib.sha256(raw_old.encode("ascii")).digest(), acc_id,
                      int(time.time()) - 7200, int(time.time()) - 3600))
        conn.commit(); conn.close()
        check("400 sur un jeton perime",
              api.call("POST", "/auth/reset",
                       {"token": raw_old, "password": "unautremotdepasse"})[0] == 400)

        code, res = api.call("POST", "/auth/reset",
                             {"token": reset_token, "password": "motdepasseapresoubli"})
        check("200 avec un jeton valide", code == 200, (code, res))
        check("une session est ouverte directement", bool(res and res.get("token")))
        after_reset = res["token"] if res else ""

        check("le jeton de reinitialisation ne resservira pas",
              api.call("POST", "/auth/reset",
                       {"token": reset_token, "password": "encoreunautre"})[0] == 400)
        check("l'ancien mot de passe ne marche plus",
              api.call("POST", "/auth/login",
                       {"email": "amine@example.com",
                        "password": "nouveaumotdepasse"})[0] == 401)
        check("le nouveau mot de passe marche",
              api.call("POST", "/auth/login",
                       {"email": "amine@example.com",
                        "password": "motdepasseapresoubli"})[0] == 200)
        check("tous les appareils ont ete deconnectes",
              api.call("GET", "/me", token=token)[0] == 401)
        check("la session ouverte par la reinitialisation est valable",
              api.call("GET", "/me", token=after_reset)[0] == 200)

        code, res = api.call("GET", "/sync", token=after_reset)
        check("la progression a survecu a la reinitialisation",
              code == 200 and res["data"]["p"]["16"][0] == 5, res)

        print("\nSuppression du compte")
        check("401 sans le mot de passe",
              api.call("DELETE", "/account", {"password": "faux"}, token=after_reset)[0] == 401)
        check("204 avec le mot de passe",
              api.call("DELETE", "/account", {"password": "motdepasseapresoubli"},
                       token=after_reset)[0] == 204)
        check("le jeton ne vaut plus rien",
              api.call("GET", "/me", token=after_reset)[0] == 401)
        code, _ = api.call("POST", "/auth/login",
                           {"email": "amine@example.com",
                            "password": "motdepasseapresoubli"})
        check("on ne peut plus se connecter", code == 401, code)
        code, _ = api.call("POST", "/auth/register",
                           {"email": "amine@example.com", "name": "Amine",
                            "password": "correcthorse"})
        check("l'adresse est de nouveau libre", code == 202, code)

        print("\nRoutes inconnues")
        check("404 sur une route inventee", api.call("GET", "/nexistepas")[0] == 404)

        # Placé en dernier : ces échecs saturent volontairement le
        # compteur de l'adresse IP, plus rien ne peut se connecter après.
        print("\nLa limite compte les echecs, pas les reussites")
        # Une IP a elle seule : les echecs des sections precedentes ne
        # doivent pas fausser le compte, et cela verifie du meme coup que
        # les compteurs sont bien separes par client.
        IP = "203.0.113.7"
        before = len(sink.messages)
        api.call("POST", "/auth/register",
                 {"email": "quota@example.com", "name": "Quota",
                  "password": "correcthorse"}, ip=IP)
        jeton_q = lien_du_mail(wait_mail(before), "confirm")
        api.call("POST", "/auth/confirm", {"token": jeton_q}, ip=IP)

        for i in range(9):
            api.call("POST", "/auth/login",
                     {"email": "quota@example.com", "password": "faux%d" % i}, ip=IP)
        code, _ = api.call("POST", "/auth/login",
                           {"email": "quota@example.com", "password": "correcthorse"},
                           ip=IP)
        check("9 echecs ne bloquent pas une connexion valable", code == 200, code)

        code, _ = api.call("POST", "/auth/login",
                           {"email": "quota@example.com", "password": "correcthorse"},
                           ip="203.0.113.99")
        check("un autre appareil n'est pas puni pour ces echecs", code == 200, code)

        for i in range(6):
            api.call("POST", "/auth/login",
                     {"email": "quota@example.com", "password": "encorefaux%d" % i},
                     ip=IP)
        code, res = api.call("POST", "/auth/login",
                             {"email": "quota@example.com", "password": "correcthorse"},
                             ip=IP)
        check("au-dela, tout est refuse le temps que ca retombe",
              code == 429 and res["error"] == "too_many", (code, res))

        print("\nHEAD (sondes de supervision)")
        code, res = api.call("HEAD", "/health")
        check("200 en HEAD sur /health", code == 200, code)
        check("aucun corps en HEAD", res is None, res)
        check("GET /health renvoie toujours son corps",
              api.call("GET", "/health")[1] == {"ok": True})

    finally:
        sink.shutdown()
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

    print("\n%d verifications, %d echec(s)" % (CHECKS[0], len(FAILURES)))
    if FAILURES:
        for f in FAILURES:
            print("  - " + f)
        sys.exit(1)
    print("Tout est vert.")


if __name__ == "__main__":
    main()
