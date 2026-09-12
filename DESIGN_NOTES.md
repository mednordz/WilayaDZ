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
