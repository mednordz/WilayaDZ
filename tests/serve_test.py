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

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

os.environ.setdefault("WILAYA_DB", "/tmp/wilayadz-e2e.sqlite3")
import app as api  # noqa: E402  (doit suivre la mise en place de WILAYA_DB)

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8390
PAGE = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "app", "wilaya-v6.html")
SW = os.path.join(os.path.dirname(PAGE), "sw.js")


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

    def do_GET(self):
        if self._is_api():
            return api.Handler.do_GET(self)
        self._static()

    def do_HEAD(self):
        if self._is_api():
            return self._send(405, {"error": "method"})
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
