#!/usr/bin/env python3
"""
Retire la pancarte chiffrée que chaque mascotte brandit.

Pourquoi : le nombre est fixe (01, 33, 16, 47) et ne correspond jamais à
l'étape affichée — la pancarte ment au lecteur.

Comment : pas au rectangle. Un cadre tracé à la main emporte toujours
autre chose au passage (l'oreille du fennec, les palmes du palmier).
Deux observations rendent la découpe exacte :

  · une fois le fond retiré, la pancarte est un ÎLOT : elle ne touche
    pas le corps, il y a une frange transparente entre la patte et elle ;
  · sa bordure a un vert sombre bien à elle, ~(40,135,47), distinct du
    vert vif des écharpes.

On étiquette donc les composantes opaques, et on ne supprime que celles
qui portent ce vert-là. Le reste du personnage est intact par
construction — aucune coordonnée à régler à la main.
"""
import os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.spatial import ConvexHull

DIR = "/tmp/wilayas/mascots"
NAMES = ["fennec", "chameau", "cigogne", "palmier"]
TARGET = 300

CARD_GREEN = np.array([40, 135, 47])   # relevé sur la bordure des pancartes
GREEN_TOL = 46                          # assez serré pour épargner les écharpes
MIN_GREEN_PX = 150                      # une vraie bordure, pas quelques pixels


def card_mask(rgb, alpha, W, H):
    """Masque exact de la pancarte — sa forme, pas son cadre.

    Un rectangle englobant mordait toujours quelque chose au passage :
    la joue du fennec d'un côté, sa patte de l'autre. La bordure verte
    forme un anneau fermé ; le remplir donne la silhouette exacte de la
    pancarte, et rien d'autre n'est touché.

    Les écharpes et le tapis de selle partagent la teinte mais vivent
    sur la moitié gauche : le filtre de position les écarte.
    """
    green = (np.sqrt(((rgb - CARD_GREEN) ** 2).sum(axis=2)) < GREEN_TOL) & (alpha > 40)
    lab, n = ndimage.label(green)
    best, best_area = None, 0
    for i in range(1, n + 1):
        comp = lab == i
        if comp.sum() < MIN_GREEN_PX:
            continue
        ys, xs = np.where(comp)
        if xs.min() / W < 0.58:
            continue
        area = (xs.max() - xs.min()) * (ys.max() - ys.min())
        if area > best_area:
            best, best_area = comp, area
    if best is None:
        return None
    # L'anneau est ouvert là où la patte passe devant : le remplir
    # laisse fuir le remplissage. La pancarte étant un quadrilatère
    # convexe (un carré arrondi, légèrement incliné), son enveloppe
    # convexe la décrit exactement. Et parce qu'elle épouse l'inclinaison,
    # elle n'attrape pas la joue du fennec — ce que faisait le rectangle
    # droit, qui devait déborder pour contenir un carré penché.
    ys, xs = np.where(best)
    pts = np.column_stack([xs, ys])
    hull = ConvexHull(pts)
    poly = [tuple(map(float, pts[v])) for v in hull.vertices]
    shape = Image.new("1", (W, H), 0)
    ImageDraw.Draw(shape).polygon(poly, fill=1)
    return ndimage.binary_dilation(np.asarray(shape, dtype=bool), iterations=2)


def strip_card(name):
    im = Image.open(os.path.join(DIR, name + "_adobe_raw.png")).convert("RGBA")
    a = np.asarray(im).astype(int).copy()
    H, W = a.shape[0], a.shape[1]
    mask = card_mask(a[:, :, :3], a[:, :, 3], W, H)
    removed = 0
    if mask is not None:
        removed = int((mask & (a[:, :, 3] > 0)).sum())
        a[mask, 3] = 0

    im = Image.fromarray(a.astype(np.uint8), "RGBA")
    bb = im.getbbox()
    if bb:
        im = im.crop(bb)
    w, h = im.size
    s = TARGET / max(w, h)
    if s < 1:
        im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    return im, removed


def main():
    imgs, total = [], 0
    for n in NAMES:
        im, removed = strip_card(n)
        im.save(os.path.join(DIR, n + ".png"))
        p = os.path.join(DIR, n + ".webp")
        im.save(p, "WEBP", quality=88, method=6)
        total += os.path.getsize(p)
        imgs.append((n, im))
        print("%-8s %3d x %3d  %5.1f Ko   pancarte : %d px retirés"
              % (n, im.width, im.height, os.path.getsize(p) / 1024, removed))
    print("total : %.1f Ko  (~%.1f Ko en base64)" % (total / 1024, total * 4 / 3 / 1024))

    H = max(i.height for _, i in imgs)
    W = sum(i.width for _, i in imgs) + 50
    sh = Image.new("RGB", (W, H), (255, 0, 255))
    x = 0
    for _, i in imgs:
        sh.paste(i, (x, H - i.height), i); x += i.width + 12
    sh.resize((W * 2, H * 2), Image.LANCZOS).save(os.path.join(DIR, "check_zoom.png"))


if __name__ == "__main__":
    main()
