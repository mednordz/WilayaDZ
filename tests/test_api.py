#!/usr/bin/env python3
"""
Tests du service de comptes (server/app.py).

Lance une instance jetable sur un port libre, avec une base SQLite
temporaire, et l'exerce par HTTP reel — pas d'appel direct aux
fonctions : ce qui est verifie, c'est ce qu'un appareil verra.

    python3 tests/test_api.py
"""

import json
import os
import socket
import subprocess
import sys
import tempfile
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
    tmp = tempfile.mkdtemp(prefix="wilayadz-test-")
    db = os.path.join(tmp, "test.sqlite3")
    env = dict(os.environ, WILAYA_DB=db, PORT=str(port))
    proc = subprocess.Popen([sys.executable, os.path.join(ROOT, "server", "app.py")],
                            env=env, stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL)
    api = Api("http://127.0.0.1:%d/api" % port)

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

        print("\nSuppression du compte")
        check("401 sans le mot de passe",
              api.call("DELETE", "/account", {"password": "faux"}, token=token)[0] == 401)
        check("204 avec le mot de passe",
              api.call("DELETE", "/account", {"password": "nouveaumotdepasse"},
                       token=token)[0] == 204)
        check("le jeton ne vaut plus rien",
              api.call("GET", "/me", token=token)[0] == 401)
        check("on ne peut plus se connecter",
              api.call("POST", "/auth/login",
                       {"email": "amine@example.com",
                        "password": "nouveaumotdepasse"})[0] == 401)
        check("l'adresse est de nouveau libre",
              api.call("POST", "/auth/register",
                       {"email": "amine@example.com", "name": "Amine",
                        "password": "correcthorse"})[0] == 201)

        print("\nRoutes inconnues")
        check("404 sur une route inventee", api.call("GET", "/nexistepas")[0] == 404)

    finally:
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
