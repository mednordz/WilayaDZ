#!/usr/bin/env python3
"""
Intègre TOUTES les polices de l'application en base64 dans le CSS.

Pourquoi : l'APK Android fonctionne hors ligne — un <link> vers Google
Fonts n'y charge jamais. Sans intégration, l'app retombe silencieusement
sur la police système du téléphone et perd toute son identité visuelle.
L'artifact publié, lui, bloque tous les hôtes sauf Google Fonts.
Une seule solution couvre les deux : la police vit dans le fichier.

  · Nunito (OFL)            — ronde et grasse, l'ossature de l'interface
  · BouazziMaghribi (MIT)   — script maghrébin, l'arabe

On ne garde que les glyphes réellement utilisés : le jeu latin est
extrait des sources, le jeu arabe est déjà listé dans ar_charset.txt.

Usage :
    python3 embed_all_fonts.py
"""
import os, re, io, base64, glob

SRC = "/tmp/wilayas"
NUNITO = SRC + "/node_modules/@fontsource/nunito/files/nunito-latin-%s-normal.woff2"
BOUAZZI = "/tmp/bouazzi-maghribi/fonts/OTF/BouazziMaghribi-Regular.otf"
OUT = SRC + "/font_face.css"


def latin_charset():
    """Tous les caractères latins/ponctuation présents dans les sources."""
    chars = set()
    for path in glob.glob(SRC + "/p[0-9]*.*") + [SRC + "/part_data.js"]:
        try:
            txt = open(path, encoding="utf-8").read()
        except Exception:
            continue
        for ch in txt:
            o = ord(ch)
            # latin de base + supplément latin-1 + latin étendu-A + ponctuation générale
            if 0x20 <= o <= 0x24F or 0x2018 <= o <= 0x201D or o in (0x2013, 0x2014, 0x2026, 0x00B7, 0x2192, 0x2190, 0x2193, 0x1D49):
                chars.add(ch)
    # garanties : chiffres, lettres, ponctuation courante même si absente des sources
    for extra in ("0123456789abcdefghijklmnopqrstuvwxyz"
                  "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                  "àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇœŒ"
                  " .,;:!?'\"()[]{}«»–—…·%+-*/=<>@#&_|~^\\$€"):
        chars.add(extra)
    return chars


def subset(path, unicodes, keep_layout):
    from fontTools.ttLib import TTFont
    from fontTools.subset import Subsetter, Options
    font = TTFont(path)
    opts = Options()
    # Pour l'arabe, les tables de liaison (init/medi/fina/isol) sont vitales :
    # sans elles les lettres s'affichent détachées.
    opts.layout_features = ["*"] if keep_layout else ["kern", "liga", "calt"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.drop_tables = []
    opts.desubroutinize = False
    sub = Subsetter(options=opts)
    sub.populate(unicodes=unicodes)
    sub.subset(font)
    buf = io.BytesIO()
    font.flavor = "woff2"
    font.save(buf)
    return buf.getvalue(), font


def face(family, weight, data, comment):
    b64 = base64.b64encode(data).decode("ascii")
    return (
        "  /* %s */\n"
        "  @font-face{\n"
        "    font-family:'%s';\n"
        "    font-style:normal;\n"
        "    font-weight:%s;\n"
        "    font-display:swap;\n"
        "    src:url(data:font/woff2;base64,%s) format('woff2');\n"
        "  }\n"
    ) % (comment, family, weight, b64)


def main():
    latin = latin_charset()
    latin_u = {ord(c) for c in latin}
    arabic = open(SRC + "/ar_charset.txt", encoding="utf-8").read()
    arabic_u = {ord(c) for c in arabic if c not in "\r\n"}

    css = ["  /* Polices intégrées : l'APK est hors ligne et l'artifact\n"
           "     bloque les hôtes externes. Sous-ensembles aux glyphes utilisés. */\n"]
    total = 0

    for w in ("400", "700", "800", "900"):
        src = NUNITO % w
        data, _ = subset(src, latin_u, keep_layout=False)
        total += len(data)
        css.append(face("Nunito", w, data,
                        "Nunito %s (OFL) — %d glyphes latins" % (w, len(latin_u))))
        print("Nunito %s : %6.1f Ko -> %6.1f Ko" % (w, os.path.getsize(src)/1024, len(data)/1024))

    data, font = subset(BOUAZZI, arabic_u, keep_layout=True)
    total += len(data)
    css.append(face("BouazziMaghribi", "400", data,
                    "Bouazzi Maghribi (MIT) — script maghrebin, %d glyphes" % len(arabic_u)))
    print("Bouazzi  : %6.1f Ko -> %6.1f Ko" % (os.path.getsize(BOUAZZI)/1024, len(data)/1024))

    # Contrôle : la liaison arabe a-t-elle survécu au sous-ensemble ?
    feats = set()
    for tag in ("GSUB", "GPOS"):
        if tag in font and font[tag].table.FeatureList:
            for fr in font[tag].table.FeatureList.FeatureRecord:
                feats.add(fr.FeatureTag)
    missing = {"init", "medi", "fina"} - feats
    print("liaison arabe :", "OK" if not missing else "MANQUE " + ", ".join(sorted(missing)))

    open(OUT, "w", encoding="utf-8").write("".join(css))
    print("total police  : %.1f Ko binaire (~%.1f Ko en base64)" % (total/1024, total*4/3/1024))
    print("ecrit         :", OUT)


if __name__ == "__main__":
    main()
