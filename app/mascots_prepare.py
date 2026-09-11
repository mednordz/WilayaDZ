#!/usr/bin/env python3
"""
Prépare les quatre mascottes pour l'application.

Contraintes :
  · l'APK fonctionne hors ligne — aucune image ne peut être téléchargée ;
  · l'artifact publié bloque les hôtes externes.
Les images doivent donc vivre DANS le fichier, en base64. À 1254x1254 en
PNG c'est impensable : on détoure, on recadre au contenu, on réduit, et
on encode en WebP (avec canal alpha).

Le détourage se fait par remplissage depuis les bords : on ne supprime
que les pixels « couleur de fond » CONNECTÉS au bord de l'image. Un
simple filtre par couleur percerait le corps blanc de la cigogne ou
l'écharpe blanche du fennec — ces blancs-là ne touchent pas le bord.
"""
import os, glob, io
import numpy as np
from PIL import Image
from scipy import ndimage

SRC_DIR = "/root/.claude/uploads/8787b827-ae3f-5205-bc3f-c64a2796c84f"
OUT_DIR = "/tmp/wilayas/mascots"
TARGET = 300          # côté max après réduction (affiché ~150px, net en 2x)
# Seuil volontairement serré : le corps blanc de la cigogne (255,255,255)
# n'est qu'à ~12 de distance du fond crème (252,248,246). Au-delà de ~10,
# le remplissage franchit le bord anticrénelé et vide l'oiseau.
TOL = 10
SHADOW_TOL = 40       # portée du retrait de l'ombre au sol (grise, plus sombre que le fond)
FEATHER_PX = 2        # largeur, en pixels, du dégradé de bord
FEATHER_TOL = 34      # distance couleur au-delà de laquelle un pixel de bord est opaque

# L'ordre des fichiers correspond à l'ordre d'envoi par l'utilisateur.
NAMES = {
    "ef07b4ef-image.png": "fennec",   # fennec — l'emblème, compagnon principal
    "093b9ca2-image.png": "chameau",  # chameau — le Sud
    "96b00b35-image.png": "cigogne",  # cigogne — l'Est / Constantine
    "f12b73c9-image.png": "palmier",  # palmier-dattier — les oasis
}


def cutout(path):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.int16)

    # Couleur de fond : moyenne des quatre coins.
    corners = np.array([a[2, 2], a[2, -3], a[-3, 2], a[-3, -3]], dtype=np.float64)
    bg = corners.mean(axis=0)

    dist = np.sqrt(((a - bg) ** 2).sum(axis=2))

    # L'ombre portée sous le personnage est grise et LÉGÈREMENT PLUS SOMBRE
    # que le fond ; le corps blanc de la cigogne est PLUS CLAIR. C'est la
    # direction de luminance — pas la distance — qui les sépare proprement.
    lum = a.mean(axis=2)
    bg_lum = bg.mean()
    spread = a.max(axis=2) - a.min(axis=2)          # neutre = faible écart entre canaux
    # Mesuré sur les sources : l'ombre vaut ~(243,235,225) — distance ~30
    # du fond, écart entre canaux ~18 (elle est chaude, pas neutre).
    # Le corps blanc de la cigogne (255,255,255) est plus CLAIR que le
    # fond : la comparaison de luminance suffit à l'épargner.
    shadow = (lum < bg_lum) & (dist < SHADOW_TOL) & (spread < 26)

    # 1) noyau : fond franc + ombre portée, connectés au bord de l'image
    core = (dist < TOL) | shadow
    lab, n = ndimage.label(core)
    border_labels = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
    border_labels.discard(0)
    outside = np.isin(lab, list(border_labels))

    # 2) bord doux — SPATIAL, pas colorimétrique. On n'adoucit que la
    #    fine bande de pixels qui touche le fond détecté ; ailleurs
    #    l'image reste pleinement opaque. Un adoucissement basé sur la
    #    seule couleur effacerait les blancs internes (cigogne, écharpes).
    band = ndimage.binary_dilation(outside, iterations=FEATHER_PX) & ~outside

    alpha = np.full(dist.shape, 255.0)
    alpha[band] = np.clip(dist[band] / FEATHER_TOL * 255.0, 0, 255)
    alpha[outside] = 0.0

    rgba = np.dstack([np.asarray(im), alpha.astype(np.uint8)])
    out = Image.fromarray(rgba, "RGBA")

    # 3) recadrage au contenu réel (marge de 2 px)
    bbox = out.getbbox()
    if bbox:
        x0, y0, x1, y1 = bbox
        out = out.crop((max(0, x0 - 2), max(0, y0 - 2),
                        min(out.width, x1 + 2), min(out.height, y1 + 2)))

    # 4) réduction sur le côté long
    w, h = out.size
    s = TARGET / max(w, h)
    if s < 1:
        out = out.resize((round(w * s), round(h * s)), Image.LANCZOS)
    return out


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    total = 0
    for path in sorted(glob.glob(SRC_DIR + "/*image.png")):
        base = os.path.basename(path)
        name = NAMES.get(base)
        if not name:
            print("ignoré :", base)
            continue
        img = cutout(path)
        webp = os.path.join(OUT_DIR, name + ".webp")
        img.save(webp, "WEBP", quality=88, method=6)
        png = os.path.join(OUT_DIR, name + ".png")   # pour contrôle visuel
        img.save(png)
        size = os.path.getsize(webp)
        total += size
        print("%-9s %s  ->  %4.1f Ko webp  (%d x %d)"
              % (name, os.path.getsize(path) // 1024, size / 1024, img.width, img.height))
    print("total : %.1f Ko binaire  (~%.1f Ko en base64)" % (total / 1024, total * 4 / 3 / 1024))


if __name__ == "__main__":
    main()
