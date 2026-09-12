# Panorama algérien — carte Infos

Illustration originale générée avec l’outil intégré imagegen le 12 septembre 2026.
Source : `panorama-algerien.png`. Version embarquée : `panorama-algerien.webp`.

Composition symbolique : terrasses blanches inspirées de la Casbah d’Alger et Méditerranée, architecture du Mzab et palmiers, rochers du Hoggar. Il ne s’agit ni d’une photographie documentaire ni de lieux voisins. Le paysage ne fournit aucune donnée géographique à la carte.

L’image apparaît dans une bande à l’intérieur du cadre de carte existant, sans changer les autres écrans. Aucun texte n’est superposé à l’image. Le libellé visible la présente comme une illustration ; elle est décorative pour les lecteurs d’écran.

Conversion reproductible : `cwebp -quiet -resize 830 0 -q 82 app/assets/illustrations/panorama-algerien.png -o app/assets/illustrations/panorama-algerien.webp`. `build.py` embarque le WebP dans le HTML pour préserver le fonctionnement hors ligne.

## Prompt final

Use case: illustration-story. Create one original premium panoramic illustration for WilayaDZ, a French/Arabic educational mobile app about Algeria. Subject: a quiet, recognizably Algerian landscape montage, with the white stepped terraces of the Casbah of Algiers overlooking a muted turquoise Mediterranean on the left, simple ochre Mzab ksar architecture with a tapered minaret and date palms toward the center, and the distinctive dark volcanic rock spires of the Hoggar with warm sand on the right. These are separate symbolic motifs in an illustrated panorama, not a claim that they are neighboring places. Respect Algerian architectural character: modest whitewashed houses, flat terraces, restrained geometry; no Moroccan tourist riads, no blue Chefchaouen, no Gulf skyscrapers, no fantasy palaces. Style: refined softly dimensional storybook illustration, warm tactile plaster and rock, matching a dark Sahara brown, copper orange and cream educational interface. Low drama, authentic local visual vocabulary, soft evening light, understated rich details. Very wide composition roughly 3:1, subjects occupy lower two thirds, soft warm atmospheric sky. Purpose: a compact decorative strip directly above a map, legible at 350px width, not a large hero. No map, no boundaries, no labels, no flags, no people, no characters, no text, no watermark. This is an illustration, not a documentary photograph.
