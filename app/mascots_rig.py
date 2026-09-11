#!/usr/bin/env python3
"""
Découpe chaque mascotte en deux pièces articulées : tête et corps.

Pourquoi ce découpage et pas un autre. Déformer une image entière ne
donne qu'un autocollant qui respire. En animation 2D, l'expression vient
d'abord de la tête : elle s'incline, se tourne, acquiesce, retombe. Une
tête articulée sur un corps qui respire suffit à faire croire au vivant.

Pourquoi la coupe passe au cou. C'est le seul endroit où la jointure ne
se voit pas — et les quatre personnages portent une écharpe exactement
là. Elle recouvre la couture pendant la rotation. Sans elle il aurait
fallu une déformation de maillage, hors de portée ici.

La tête déborde sous la ligne de coupe (une « langue ») : en tournant,
cette langue reste couverte par le corps, donc aucun trou n'apparaît au
cou. C'est la technique de découpage articulé classique.

Aucun service ne fait ce travail : la segmentation d'Adobe ne reconnaît
que des corps humains et renvoie le personnage entier sur un animal
dessiné (mesuré : 99,6 % de recouvrement). D'où ce découpage géométrique.
"""
import os, json
import numpy as np
from PIL import Image

DIR = "/tmp/wilayas/mascots"
TARGET_H = 340          # hauteur de travail ; l'affichage descend jusqu'à ~46 px

# cut  : hauteur de la coupe, en fraction du personnage (au niveau de l'écharpe)
# pivot: axe de rotation de la tête, en fraction (x, y) du cadre complet
# tongue: débord de la tête sous la coupe, en fraction — masqué par le corps
RIG = {
    "fennec":  {"cut": 0.60, "pivot": (0.44, 0.62), "tongue": 0.10},
    "chameau": {"cut": 0.47, "pivot": (0.52, 0.49), "tongue": 0.09},
    "cigogne": {"cut": 0.46, "pivot": (0.46, 0.48), "tongue": 0.09},
    "palmier": {"cut": 0.62, "pivot": (0.48, 0.64), "tongue": 0.08},
}


def build(name):
    im = Image.open(os.path.join(DIR, name + "_clean_full.png")).convert("RGBA")
    bb = im.getbbox()
    im = im.crop(bb)
    W, H = im.size
    s = TARGET_H / H
    im = im.resize((max(1, round(W * s)), TARGET_H), Image.LANCZOS)
    W, H = im.size

    cfg = RIG[name]
    y_cut = round(cfg["cut"] * H)
    y_tongue = min(H, round((cfg["cut"] + cfg["tongue"]) * H))

    a = np.asarray(im).astype(np.uint8)

    head = a.copy()
    head[y_tongue:, :, 3] = 0          # la tête s'arrête après sa langue

    body = a.copy()
    body[:y_cut, :, 3] = 0             # le corps commence à la coupe

    out = {}
    for tag, arr in (("head", head), ("body", body)):
        img = Image.fromarray(arr, "RGBA")
        p = os.path.join(DIR, "%s_%s.webp" % (name, tag))
        img.save(p, "WEBP", quality=88, method=6)
        img.save(os.path.join(DIR, "%s_%s.png" % (name, tag)))
        out[tag] = os.path.getsize(p)
    return im, W, H, y_cut, y_tongue, out


def main():
    meta, total = {}, 0
    sheets = []
    for n in RIG:
        im, W, H, y_cut, y_tongue, sizes = build(n)
        total += sizes["head"] + sizes["body"]
        meta[n] = {"w": W, "h": H, "pivot": RIG[n]["pivot"]}
        sheets.append((n, W, H, y_cut, y_tongue))
        print("%-8s %3dx%3d  coupe y=%3d  langue jusqu'à %3d   tête %4.1f Ko + corps %4.1f Ko"
              % (n, W, H, y_cut, y_tongue, sizes["head"] / 1024, sizes["body"] / 1024))
    print("total : %.1f Ko  (~%.1f Ko en base64)" % (total / 1024, total * 4 / 3 / 1024))
    json.dump(meta, open(os.path.join(DIR, "rig.json"), "w"), indent=1)

    # planche de contrôle : les deux pièces écartées, pour voir la coupe
    gap = 40
    W = sum(s[1] for s in sheets) * 1 + 60
    Hs = max(s[2] for s in sheets) * 2 + gap
    sheet = Image.new("RGB", (W, Hs), (255, 0, 255))
    x = 0
    for n, w, h, _, _ in sheets:
        sheet.paste(Image.open(os.path.join(DIR, n + "_head.png")), (x, 0),
                    Image.open(os.path.join(DIR, n + "_head.png")))
        sheet.paste(Image.open(os.path.join(DIR, n + "_body.png")), (x, h + gap),
                    Image.open(os.path.join(DIR, n + "_body.png")))
        x += w + 15
    sheet.save(os.path.join(DIR, "check_rig.png"))


if __name__ == "__main__":
    main()
