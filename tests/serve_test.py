#!/usr/bin/env python3
"""
Serveur d'essai : l'application ET son API sur une meme origine.

En production ce role est tenu par nginx (fichiers statiques + proxy
vers le conteneur wilaya-api). Ici on reproduit la meme topologie dans
un seul processus, pour pouvoir eprouver la synchronisation depuis un
vrai navigateur sans installer Docker.

    python3 tests/serve_test.py [port] [chemin/vers/wilaya-v6.html]
"""

import os
import sys

import email as emaillib
import re
import socket
import threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from test_api import MailSink  # noqa: E402  (voisin, pas une dependance)

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8390
PAGE = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "app", "wilaya-v6.html")
SW = os.path.join(os.path.dirname(PAGE), "sw.js")
# La musique de fond, servie comme nginx la sert : depuis un dossier a
# part, avec les requetes Range. Sans elles, un navigateur ne peut pas
# avancer dans une piste de quarante minutes sans la telecharger en
# entier — et c'est precisement ce qu'on veut eprouver.
MEDIA = os.path.join(ROOT, "deploy", "media")
# Les MEMES types que ceux declares dans deploy/nginx.conf. nginx ne
# connait nativement ni .opus ni .m4a : un essai qui servirait un type
# different de la production ne prouverait rien sur la production.
MEDIA_TYPES = {".opus": "audio/ogg", ".m4a": "audio/mp4", ".mp3": "audio/mpeg"}


def _free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


# Un serveur de mail jetable, pour que le parcours « mot de passe
# oublie » soit eprouvable depuis un navigateur sans rien envoyer a
# personne. Le lien capture est relu par le test via /__essai__/dernier-lien.
MAIL_PORT = _free_port()
SINK = MailSink(MAIL_PORT)
threading.Thread(target=SINK.serve_forever, daemon=True).start()

os.environ.setdefault("WILAYA_DB", "/tmp/wilayadz-e2e.sqlite3")
os.environ["SMTP_HOST"] = "127.0.0.1"
os.environ["SMTP_PORT"] = str(MAIL_PORT)
os.environ.setdefault("APP_URL", "http://127.0.0.1:%d" % PORT)

import app as api  # noqa: E402  (doit suivre la mise en place de l'environnement)


def dernier_lien(genre="reset"):
    """Le lien du dernier message recu, decode comme le ferait un client
    de messagerie (le corps part en quoted-printable, qui coupe les
    longues lignes). `genre` vaut « reset » ou « confirm »."""
    if not SINK.messages:
        return ""
    parsed = emaillib.message_from_string(SINK.messages[-1])
    morceaux = []
    for part in parsed.walk():
        if part.get_content_maintype() == "text":
            charge = part.get_payload(decode=True)
            if charge:
                morceaux.append(charge.decode(part.get_content_charset() or "utf-8",
                                              "replace"))
    trouve = re.search(r"https?://[^\s\"<>]+/#%s=[A-Za-z0-9_-]+" % genre,
                       "\n".join(morceaux))
    return trouve.group(0) if trouve else ""


class Combined(api.Handler):
    """Tout ce qui ne commence pas par /api est un fichier."""

    def _is_api(self):
        return self.path.split("?")[0].startswith("/api")

    def _static(self):
        path = self.path.split("?")[0]
        target = SW if path == "/sw.js" else PAGE
        ctype = ("application/javascript" if path == "/sw.js"
                 else "text/html; charset=utf-8")
        try:
            with open(target, "rb") as fh:
                body = fh.read()
        except OSError:
            return self._send(404, {"error": "not_found"})
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _media(self):
        """Sert /media/<nom>, en honorant l'en-tete Range."""
        nom = os.path.basename(self.path.split("?")[0])
        chemin = os.path.join(MEDIA, nom)
        ext = os.path.splitext(nom)[1]
        if ext not in MEDIA_TYPES or not os.path.isfile(chemin):
            return self._send(404, {"error": "not_found"})
        taille = os.path.getsize(chemin)
        debut, fin = 0, taille - 1
        plage = self.headers.get("Range", "")
        partiel = False
        trouve = re.match(r"bytes=(\d*)-(\d*)$", plage.strip())
        if trouve:
            g, d = trouve.group(1), trouve.group(2)
            if g:
                debut = int(g)
                if d:
                    fin = min(int(d), taille - 1)
            elif d:                      # bytes=-N : les N derniers octets
                debut = max(0, taille - int(d))
            if debut > fin or debut >= taille:
                self.send_response(416)
                self.send_header("Content-Range", "bytes */%d" % taille)
                self.end_headers()
                return
            partiel = True
        with open(chemin, "rb") as fh:
            fh.seek(debut)
            corps = fh.read(fin - debut + 1)
        self.send_response(206 if partiel else 200)
        self.send_header("Content-Type", MEDIA_TYPES[ext])
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(len(corps)))
        if partiel:
            self.send_header("Content-Range", "bytes %d-%d/%d" % (debut, fin, taille))
        self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        self.end_headers()
        self.wfile.write(corps)

    def do_GET(self):
        # Reserve aux essais : jamais servi par nginx en production, qui
        # ne relaie que /api/ vers le service et sert des fichiers pour
        # tout le reste.
        if self.path.split("?")[0] == "/__essai__/dernier-lien":
            genre = "confirm" if "genre=confirm" in self.path else "reset"
            return self._send(200, {"lien": dernier_lien(genre)})
        if self._is_api():
            return api.Handler.do_GET(self)
        if self.path.split("?")[0].startswith("/media/"):
            return self._media()
        self._static()

    def do_HEAD(self):
        if self._is_api():
            return api.Handler.do_HEAD(self)
        if self.path.split("?")[0].startswith("/media/"):
            return self._media()
        self._static()


def main():
    from http.server import ThreadingHTTPServer
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Combined)
    srv.daemon_threads = True
    print("essai : http://127.0.0.1:%d/  (page %s)" % (PORT, PAGE), flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()


if __name__ == "__main__":
    main()
