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

    def call(self, method, path, body=None, token=None, raw_auth=None):
        data = None
        headers = {}
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = "Bearer " + token
        if raw_auth is not None:
            headers["Authorization"] = raw_auth
        req = urllib.request.Request(self.base + path, data=data,
                                     headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                raw = res.read().decode("utf-8")
                return res.status, (json.loads(raw) if raw else None)
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8")
            return e.code, (json.loads(raw) if raw else None)


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

        print("\nCreation de compte")
        code, res = api.call("POST", "/auth/register",
                             {"email": "  Amine@Example.COM ", "name": "Amine",
                              "password": "correcthorse"})
        check("201 a la creation", code == 201, code)
        check("un jeton est rendu", bool(res and res.get("token")))
        check("l'adresse est normalisee",
              res["account"]["email"] == "amine@example.com",
              res["account"]["email"])
        token = res["token"]

        code, res = api.call("POST", "/auth/register",
                             {"email": "amine@example.com", "name": "X",
                              "password": "correcthorse"})
        check("409 sur adresse deja prise", code == 409 and res["error"] == "email_taken", code)

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
            check("adresse acceptee : " + good, code == 201, (code, res))

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
              code == 200 and res["version"] == 3 and res["data"]["p"]["16"][0] == 5, res)

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
        check("on ne peut plus se connecter",
              api.call("POST", "/auth/login",
                       {"email": "amine@example.com",
                        "password": "motdepasseapresoubli"})[0] == 401)
        check("l'adresse est de nouveau libre",
              api.call("POST", "/auth/register",
                       {"email": "amine@example.com", "name": "Amine",
                        "password": "correcthorse"})[0] == 201)

        print("\nRoutes inconnues")
        check("404 sur une route inventee", api.call("GET", "/nexistepas")[0] == 404)

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
