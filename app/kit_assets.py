#!/usr/bin/env python3
"""
Prepare les illustrations du kit graphique pour l'application.

Le kit livre des SVG qui contiennent en realite un PNG en base64 : ce
sont des images, pas des vecteurs (le guide du kit le dit). Telles
quelles elles pesent pres d'un megaoctet, ce qui est inacceptable pour
une application qui tient dans UN fichier et s'ouvre sur un reseau
mobile algerien.

Ce script les extrait, les redimensionne a la taille reellement
affichee, et les convertit en WebP — le meme format que les mascottes
deja embarquees. Resultat : environ dix fois moins lourd, sans
difference visible.

    python3 app/kit_assets.py            # ecrit app/p4o_kit.js

Il n'est pas lance par build.py : les illustrations ne changent pas a
chaque construction. On le relance quand le kit change.
"""

import base64
import os
import re
import shutil
import subprocess
import sys
import tempfile

KIT = os.environ.get("WILAYA_KIT", os.path.expanduser(
    "~/Documents/Codex/2026-09-12/referenced-chatgpt-conversation-this-is-an"
    "/outputs/WilayaDZ-kit-developpeur 2"))

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, "p4o_kit.js")

# Largeur de reference 415 px (guide du kit) : on prepare le double pour
# les ecrans a forte densite, et pas davantage — au-dela, le poids monte
# sans que l'œil y gagne quoi que ce soit.
PIECES = [
    # (cle JS, fichier du kit, largeur cible en pixels, qualite)
    ("banniere", "01-illustrations/banniere-algerie-sans-texte.svg", 830, 88),
    ("palmiers", "01-illustrations/decor-palmiers-gauche.svg",       151, 86),
    ("village",  "01-illustrations/decor-village-droite.svg",        131, 86),
]


def outil(nom):
    chemin = shutil.which(nom)
    if not chemin:
        raise SystemExit("outil manquant : %s" % nom)
    return chemin


def rendre(svg, largeur, sortie):
    """
    RENDRE le SVG, et non en extraire l'image integree : certaines
    illustrations du kit sont decoupees par un `clipPath` (la banniere
    est taillee en arche, avec des coins transparents). Extraire le PNG
    brut rendrait le rectangle complet et perdrait la decoupe.
    """
    subprocess.run([outil("rsvg-convert"), "-w", str(largeur),
                    "-o", sortie, svg], check=True)


def poids_source(chemin):
    """Le poids de l'image integree, pour mesurer ce qu'on economise."""
    src = open(chemin, encoding="utf-8").read()
    trouve = re.search(r'base64,([A-Za-z0-9+/=\s]+)"', src)
    return len(base64.b64decode(re.sub(r"\s", "", trouve.group(1)))) if trouve else 0


def main():
    magick, cwebp = outil("magick"), outil("cwebp")
    morceaux, total_avant, total_apres = [], 0, 0

    with tempfile.TemporaryDirectory() as tmp:
        for cle, rel, largeur, qualite in PIECES:
            source = os.path.join(KIT, rel)
            if not os.path.exists(source):
                raise SystemExit("absent du kit : %s" % rel)

            total_avant += poids_source(source)
            reduit = os.path.join(tmp, cle + ".png")
            rendre(source, largeur, reduit)

            # -alpha_q : la transparence de l'arche doit rester nette,
            # sinon son contour bronze bave sur le fond.
            webp = os.path.join(tmp, cle + ".webp")
            subprocess.run([cwebp, "-quiet", "-q", str(qualite), "-alpha_q", "100",
                            reduit, "-o", webp], check=True)

            data = open(webp, "rb").read()
            total_apres += len(data)
            dim = subprocess.run([magick, "identify", "-format", "%wx%h %[channels]", reduit],
                                 capture_output=True, text=True).stdout
            print("  %-10s %6.0f Ko  ->  %5.0f Ko   %s"
                  % (cle, poids_source(source) / 1024, len(data) / 1024, dim))
            morceaux.append((cle, dim, base64.b64encode(data).decode("ascii")))

    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write("""
  /* ============================================================
     ILLUSTRATIONS DU KIT GRAPHIQUE
     Produit par app/kit_assets.py — ne pas modifier a la main.

     Ce sont des images (le kit livre des PNG deguises en SVG),
     redimensionnees a la taille reellement affichee et converties en
     WebP. Elles pesent ensemble une fraction de ce que pesait le kit
     brut, pour un rendu identique a l'œil.
     ============================================================ */
  var KIT = {
""")
        for cle, dim, b64 in morceaux:
            f.write('    %s: { d:"%s", src:"data:image/webp;base64,%s" },\n'
                    % (cle, dim, b64))
        f.write("  };\n")

    print("\n  total : %.0f Ko  ->  %.0f Ko  (%.0f %% de moins)"
          % (total_avant / 1024, total_apres / 1024,
             100 - total_apres * 100.0 / total_avant))
    print("  ecrit : %s" % SORTIE)


if __name__ == "__main__":
    main()
