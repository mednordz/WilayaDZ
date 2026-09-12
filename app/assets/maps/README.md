# Carte de l’onglet Infos

`algeria69.svg` reprend les 69 tracés déjà présents dans le logo du projet.
Source communautaire : [Chemseddine Allioua / Algeria69WilayaMap](https://github.com/chemsallioua/Algeria69WilayaMap).
Licence MIT conservée dans `../LICENSE-carte.txt`. Ce n’est pas une source administrative officielle.

Le logo conserve son fichier et sa présentation. Pour la carte interactive, les mêmes chemins sont placés dans leur repère natif (viewBox `862.86 943.66 10000 9715`), sans la réduction du logo. La translation `translate(-862.86 -943.66)` identique sur les 69 chemins du fournisseur est portée par le viewBox : la géométrie reste identique et `getBBox()` permet de calculer les zooms dans un repère unique.

## Correspondance par nom, pas par numéro brut

La [liste du fournisseur](https://github.com/chemsallioua/Algeria69WilayaMap/blob/main/docs/WILAYAS_LIST.md), consultée le 12 septembre 2026, utilise un autre ordre pour les dernières wilayas. Les attributs `data-source-code` permettent de retrouver les identifiants originaux. Les `id` correspondent aux codes actuellement utilisés dans `part_data.js` :

| Source | Projet | Nom |
|---|---|---|
| 59 | 59 | Aflou |
| 60 | 69 | El Abiodh Sidi Cheikh |
| 61 | 63 | El Aricha |
| 62 | 61 | El Kantara |
| 63 | 60 | Barika |
| 64 | 68 | Bou Saâda |
| 65 | 62 | Bir El Ater |
| 66 | 67 | Ksar El Boukhari |
| 67 | 64 | Ksar Chellala |
| 68 | 65 | Aïn Oussara |
| 69 | 66 | Messaad |

Ce raccord ne valide pas l’ordre officiel des codes 59–69. La réserve déjà présente dans le projet reste explicite dans la carte. En cas de correction du référentiel, modifier ensemble `part_data.js`, les noms arabes et cette correspondance.

`build.py` embarque les chemins et vérifie l’unicité des codes 01–69. Aucune requête externe n’est nécessaire. Le choix de wilaya et le zoom restent locaux à la vue et ne modifient pas la progression.

La carte utilise `الشلف` pour Chlef ; le repère historique `الأصنام` dans La Clé n’est pas modifié.
