# Mascottes WilayaDZ — textiles et matières

Quatre illustrations originales dérivées des mascottes existantes avec l’outil intégré image_gen, le 12 septembre 2026. Sources PNG transparentes dans ce dossier. Les motifs sont des interprétations inspirées de l’artisanat algérien, sans attribution à une pièce historique précise.

Fennec : sable, terre cuite, turquoise. Chameau : indigo saharien. Cigogne : blanc et turquoise méditerranéen. Palmier : vert olive, dattes, terre cuite.

`python3 app/mascots_embedded.py` génère `p4i_mascots.js` : tête et corps superposés, plus un portrait cadré pour les avatars. ImageMagick normalise l’alpha, cadre, réduit et compresse en WebP. Les pivots et animations restent compatibles. `python3 app/build.py` reconstruit l’application. Les anciens fichiers dans `mascots/` restent en référence.

## Prompts finaux

### Fennec
Edit this exact fennec mascot for the Algerian learning app WilayaDZ. Keep its identity, friendly expressive face, large ears, anatomy, proportions, full-body pose with waving left paw, silhouette and neck/scarf placement exactly. Elevate it to a refined handcrafted animated-film character: finely groomed warm sand fur, cream muzzle, warm amber eyes, delicate tactile details. Replace the plain orange neck scarf with a beautifully woven burnt-orange Algerian-inspired textile, with restrained cream and deep teal geometric diamond embroidery along the triangular border, a tiny copper rosette clasp. Keep scarf same outline. Consistent warm soft lighting, premium but friendly. Isolate whole character on a TRUE TRANSPARENT background, no floor, no scenery, no cast shadow, no border, no text, no watermark. All ears and feet fully included, snug centered framing. Do not add hat or additional limbs.

### Chameau
A friendly full-body baby dromedary mascot for an Algerian educational app, exactly the same waving stance and cute proportions as the reference. Soft sand colored fur, one hump, four legs, expressive brown eyes. An indigo scarf embroidered with cream and terracotta diamond motifs and a copper rosette clasp. Refined animation illustration. Isolated on a transparent background.

### Cigogne
Edit this exact stork. Refine the existing orange scarf into teal woven cloth with cream and terracotta diamond embroidery and a small copper rosette clasp. Keep its friendly face, pose and all anatomy identical. Fine handcrafted animated-film style. Full body isolated, transparent background.

### Palmier
Edit this palm-tree mascot for WilayaDZ. Preserve its friendly face, identity, leafy silhouette, full trunk and date clusters, exact pose and scarf location. Refine the leaf veins, date fruit and carved bark in a beautifully crafted animated-film style. Change plain orange scarf to warm terracotta woven textile with olive-green and ivory geometric diamond embroidery along the same triangular border, small aged copper rosette clasp. Warm, fine, tactile, consistent soft lighting. Isolate on transparent alpha background with no floor, no scenery, no cast shadow. No text no border. Keep all leaves and full base uncropped. Background must be empty transparent pixels, not a drawing of checkerboard.

