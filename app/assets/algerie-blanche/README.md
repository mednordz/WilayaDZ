# Algérie blanche

`patio-jasmine.webp` : décor original généré avec l’outil intégré `image_gen`, le 12 septembre 2026. Export WebP 720 × 1080, qualité 78, environ 47 Ko. Aucun texte ni contrôle n’est dessiné dans l’image. Les boutons, libellés et états restent du HTML accessible.

## Prompt de génération

Use case: stylized-concept. Asset type: decorative portrait background for WilayaDZ learning path. Create an exquisite white Algiers Casbah patio illustration, ivory lime plaster, delicate carved Arab-Moorish arches along far left and right edges, small glimpses of white terraced Algiers houses and Mediterranean blue through edge arches, glazed teal Algerian floral faience, jasmine flowers and olive leaves in two corners, fine aged brass details. Hand-painted refined architectural game illustration, soft daylight. Portrait 1024x1536. Crucial composition: central 70 percent is EMPTY near-white warm ivory plaster, absolutely no objects across center, all decoration confined to outer 15 percent margins, sparse and subtle, no frame across center. No people, animals, mascots, text, letters, UI controls, medallions, logos or watermarks. Bottom and top gently fade to plain warm ivory #f5efe3 for seamless use down a scrolling app. This is scenery only, not a screenshot.

## Intégration

Le build incorpore le décor une seule fois dans `--blanche-patio`. Le parcours, les introductions et les fonds de leçon le réutilisent. La frise existante du patio fournit les rappels de céramique. Aucun téléchargement supplémentaire n’est nécessaire hors ligne.

La palette principale est définie dans `p1_css.css` : enduit ivoire et encre turquoise le jour, bleu-vert la nuit. `algerie-blanche.css` décrit les matériaux des composants communs. Le haut de page et les réglages conservent leur composition approuvée ; le parcours garde son patio clair dans les deux thèmes.

Ne pas transformer un ancêtre de la navigation fixe. Garder les états correct/incorrect, le focus clavier et les contrastes prioritaires sur la décoration. Les ressources et comportements des mascottes sont inchangés.
