# Habillage Parcours — maquette intégrée

Les sources modifiées sont `app/p1_css.css`, `app/p2_css_add.css`, `app/p3_body.html`, `app/p4a_core.js` et `app/p4d_path.js`. Le bloc « Maquette WilayaDZ » termine la feuille complémentaire ; il précise les proportions du header, des cartes et du parcours.

- Une seule arche, intégrée à l'image de bannière. La barre supérieure occupe ses angles transparents ; elle ne dessine plus un second contour. Ratio conservé, titre en HTML traduisible.
- Logo horizontal avec tracé des wilayas et nom en police embarquée ; série et XP sous forme de vrais boutons. Le bouton XP ouvre un détail et restitue le focus à la fermeture.
- Profil agrandi, cercles et libellé. Photos, avatars et indicateur de synchronisation existants sont conservés.
- Cinq rosettes pour les niveaux gagnés (`state.crowns`), de 1 à 5. Zéro signifie non commencé, pas un sixième niveau. Révisions dues séparées ; la force Leitner (`unitStrength`) reste dans le détail de l'unité. Aucune règle de progression ni donnée de compte modifiée.
- Navigation à trois arches, avec sélection visible, focus et surface tactile rectangulaire conservés.
- Même palette pour thème sombre système et thème sombre explicite. Le thème clair et le français/arabe restent disponibles.

## Illustrations reproductibles

Les sources sont désormais dans `app/assets/kit/01-illustrations/`, pour éviter de dépendre d'un dossier externe sur une machine précise. `WILAYA_KIT` permet toujours de choisir un autre kit, contenant les deux fichiers listés dans `app/kit_assets.py`.

`python3 app/kit_assets.py` régénère `p4o_kit.js` (bannière et nouveau paysage continu, environ 85 Ko WebP). Ensuite, `python3 app/build.py` reconstruit le HTML. Ne pas éditer les fichiers générés.

Le nouveau paysage a été créé avec imagegen pour ce projet : palmiers, architecture du Mzab et reliefs du Hoggar aux bords, centre sombre réservé au parcours. Il est décoratif et ne représente pas un itinéraire géographique.

Le symbole de la marque réutilise les 69 tracés de https://github.com/chemsallioua/Algeria69WilayaMap sous licence MIT, conservée dans `app/assets/LICENSE-carte.txt`. Source communautaire, pas un document cadastral officiel.

## Vérifications

`node tests/test_visual_parcours.js` vérifie six dispositions (320, 360, 415 et 768 px ; français, arabe et bilingue ; clair/sombre), les cinq niveaux, l'absence de débordement horizontal, la bannière, le bouton XP, le retour de focus, les onglets et les contrastes via axe. Les profils sont fictifs et les appels API sont bloqués.

Les audits existants tactile, accessibilité, bilingue, leçons, XSS et animations restent applicables. Le rendu varie avec la progression réelle : la carte La Clé et la carte Révision ne sont pas remplacées par une fausse étape 19–25.

## Finitions du patio algérien

Une illustration originale associe architecture blanche, Méditerranée et Hoggar derrière la mascotte. Elle reste décorative, est masquée du côté du texte et se retourne en arabe. Le thème clair atténue cette image. Le nouveau fichier source et son prompt sont dans `app/assets/kit/`. Le kit embarqué gagne environ 48 Ko de WebP.

Les cartes portent un double filet de cuivre, les repères alphabétiques des motifs géométriques discrets. Les médaillons ont une gravure intérieure et quatre petits losanges. Une bordure signale l’unité à poursuivre ; les cinq niveaux acquis et les révisions restent séparés. Les onglets utilisent une surface brune et une icône orange pour la sélection.

Vérification : six formats/langues/thèmes, audit de dix écrans et contrôle des cibles tactiles. Aucun changement de logique pédagogique ou de stockage.

## Habillage global et quatre mascottes

La famille de cadres cuivrés, de surfaces sahariennes et de touches de céramique couvre Entraînement, Infos, le registre, les cartes de mémoire, les quiz, les leçons, les résultats, les feuilles de détail, le profil, les avatars et les écrans de compte. Le patio est réutilisé dans les introductions. Les petits contrôles reçoivent des finitions adaptées à leur fonction. Les états correct/incorrect, sélection et focus restent distincts et les appuis respectent la réduction des animations.

Les quatre mascottes ont été redessinées avec des textiles brodés. Sources et prompts : `app/assets/mascottes/README.md`. Leurs portraits sont cadrés séparément pour remplir les médaillons des avatars. Aucun identifiant ni champ de compte ne change.

Validation : 18 écrans et quatre mascottes via `test_design_pages.js`, six dispositions du Parcours, dix vues et 22 écrans de compte audités, cibles tactiles, animations, six leçons complètes (69 questions).

## Carte dans Infos — évolution ciblée

La carte à points est remplacée à son emplacement par les contours des 69 wilayas, avec sélection, noms français/arabe, liste accessible, vue nationale, zoom Nord et agrandissement de la wilaya choisie. Le parcours, les mascottes, les cadres et les trois onglets sont conservés. Les choix cartographiques ne changent aucune donnée de progression.

Une petite illustration originale du littoral, du Mzab et du Hoggar occupe le haut du cadre ; elle est explicitement décorative et ne présente pas ces lieux comme voisins. Source, prompt et conversion : `app/assets/illustrations/README.md`. Le WebP embarqué pèse environ 44 Ko.

Les contours communautaires sont ceux du logo, sous MIT. Leurs codes 59–69 ont été raccordés par nom aux codes du projet : `app/assets/maps/README.md`. Ce raccord ne valide pas le référentiel administratif, dont la réserve reste visible dans « À propos de la carte ». Le déplacement des chemins du fournisseur est conservé via le viewBox, pour ne pas couper le sud.

Validation : `tests/test_map.js` couvre six formats/langues/thèmes, la correspondance des codes, le cadrage national complet, le zoom vers une wilaya hors champ, souris/clavier/liste, le décodage de l’image embarquée, la conservation de la progression et axe. Les 18 écrans et quatre mascottes de `test_design_pages.js` passent également.
