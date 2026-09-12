# Fennec Rive — première intégration

`fennec.riv` conserve les calques WebP du fennec accepté, avec articulation du corps et de la tête. Le fichier inclut ses images. Il ne contient ni police ni ressource distante.

- Artboard : `Fennec` ; machine : `Companion`.
- Animation `Idle` : respiration et légère inclinaison de tête.
- Déclencheurs : `celebrate`, `encourage`, `curious`.
- Chaque réaction revient automatiquement à `Idle`.
- Les pieds restent ancrés ; l'artboard comporte une marge de 20 px.

Le contrôleur `p4q_rive.js` anime uniquement le fennec, conserve les calques HTML en secours, libère les instances retirées et suspend le rendu invisible. Le réglage système de réduction des animations désactive Rive. Les autres personnages conservent leur animation existante.

Reconstruire : `python3 app/mascots_embedded.py`, puis `python3 app/rive_mascot.py`, puis `python3 app/build.py`. Le générateur Python écrit le format runtime Rive 7 à partir du schéma public de rive-app/rive-runtime. Ce fichier est un export runtime, pas un projet `.rev` éditable. Pour modifier les poses, ajuster les pistes dans le générateur. L'animation indépendante des yeux, oreilles et pattes demandera des calques supplémentaires.

Le runtime Canvas Lite 2.42.1 est figé dans `app/vendor/rive` et embarqué dans le HTML avec son WASM et la licence MIT. Provenance : paquet npm officiel `@rive-app/canvas-lite@2.42.1`. Les entrées de machine utilisées sont dépréciées par Rive mais prises en charge dans cette version figée ; une montée de version majeure devra migrer vers le data binding. Aucun appel CDN n'est nécessaire. Le HTML autonome augmente d'environ 1,6 Mo avant compression.

Validation : `node tests/test_rive.js` (Playwright) teste le vrai rendu WASM, le mouvement, les réactions, le nettoyage, la suspension, le secours et la réduction des animations ; `node tests/test_design_pages.js` couvre les écrans FR/AR.
