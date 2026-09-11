#!/usr/bin/env python3
"""
Finalise les quatre mascottes détourées par Adobe (détection de sujet).

Pourquoi Adobe plutôt qu'un détourage local : le corps blanc de la
cigogne est à une distance de couleur de 4 à 11 du fond crème — soit
la même teinte à l'œil de la machine. Aucun seuil colorimétrique ne
peut les séparer ; il faut une détection de sujet. Mesuré, pas supposé.

Ici on ne fait plus que du cadrage et de la compression :
  · recadrage au contenu,
  · réduction au format d'affichage (x2 pour les écrans denses),
  · WebP avec alpha — l'image doit tenir dans le fichier en base64,
    puisque l'APK est hors ligne et que l'artifact bloque les hôtes.
"""
import os, base64
from PIL import Image

DIR = "/tmp/wilayas/mascots"
NAMES = ["fennec", "chameau", "cigogne", "palmier"]
TARGET = 300


def finalize(name):
    im = Image.open(os.path.join(DIR, name + "_adobe_raw.png")).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    s = TARGET / max(w, h)
    if s < 1:
        im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    im.save(os.path.join(DIR, name + ".png"))
    webp = os.path.join(DIR, name + ".webp")
    im.save(webp, "WEBP", quality=86, method=6)
    return im, os.path.getsize(webp)


def main():
    total = 0
    imgs = []
    for n in NAMES:
        im, size = finalize(n)
        imgs.append((n, im))
        total += size
        print("%-8s %3d x %3d   %5.1f Ko" % (n, im.width, im.height, size / 1024))
    print("total : %.1f Ko  (~%.1f Ko en base64)" % (total / 1024, total * 4 / 3 / 1024))

    # planche de contrôle : fond sombre puis fond clair
    H = TARGET
    W = sum(i.width for _, i in imgs) + 40
    sheet = Image.new("RGB", (W, H * 2 + 30), (14, 23, 18))
    x = 0
    for _, i in imgs:
        sheet.paste(i, (x, 0), i); x += i.width + 10
    sheet.paste(Image.new("RGB", (W, H), (255, 255, 255)), (0, H + 30))
    x = 0
    for _, i in imgs:
        sheet.paste(i, (x, H + 30), i); x += i.width + 10
    sheet.save(os.path.join(DIR, "check_final.png"))


if __name__ == "__main__":
    main()
