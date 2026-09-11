# WilayaDZ — notes de reprise du projet

Application bilingue (français/arabe, RTL) façon Duolingo pour mémoriser les
codes des 69 wilayas d'Algérie. Ce document sert à reprendre le travail dans
Claude Code sans avoir à tout réexpliquer — il résume l'architecture, la
chaîne de build, et surtout les pièges déjà rencontrés et corrigés, pour ne
pas les refaire.

## Structure du dossier

```
app/          fichiers source de l'application (assemblés par build.py)
mascots/      images sources et rig des 4 mascottes (fennec, chameau, cigogne, palmier)
android/      projet APK (manifest, resources, keystore, dernier APK signé)
deploy/       Dockerfile + nginx + docker-compose pour l'hébergement web (voir DEPLOY.md)
server/       service de comptes et de synchronisation (Python stdlib + SQLite)
tests/        suite Playwright + tests du service de comptes (test_api.py, test_cloud_e2e.js)
AUDIT.md      rapport d'audit sécurité/accessibilité déjà réalisé
DEPLOY.md     runbook d'hébergement web (wilayadz.smnc.win sur bigpc, tunnel Cloudflare)
```

`server/` est la seule partie qui ne finit pas dans le fichier HTML : c'est
un service à part, joignable uniquement par nginx, et dont l'application
n'a **jamais** besoin pour fonctionner.

## Comment reconstruire l'app

L'app est un **unique fichier HTML autonome** (pas de bundler, pas de build
JS moderne), plus un **second fichier à part obligatoire**, `sw.js` (un
service worker ne peut pas s'enregistrer depuis un `<script>` inline — voir
plus bas). `app/build.py` concatène les morceaux dans cet ordre :
`p0_head.html` (qui commence par `<meta charset="utf-8">`, voir piège n°6),
puis un bloc `<style>` (le CSS de `p1_css.css` + `p2_css_add.css`, précédé de
`font_face.css` si présent), puis `p3_body.html`, puis un `<script>` qui
enchaîne `part_data.js`, `p4i_mascots.js`, `qr_lib.js`, `p4a_core.js`,
`p4f_i18n.js`, `p4g_account.js`, `p4b_exercises.js`, `p4c_session.js`,
`p4d_path.js`, `p4h_profileui.js`, `p4e_practice.js`, `p4j_pwa.js`. Le
script copie aussi `sw.js` à côté du fichier produit.

```bash
cd app
python3 build.py        # produit wilaya-v6.html + sw.js à côté (le nom du fichier de sortie)
```

Le script chdir sur son propre dossier (`app/`), donc il marche depuis
n'importe quel répertoire courant — ce n'était pas le cas avant (il faisait
`os.chdir('/tmp/wilayas')` en dur, un reliquat d'une session précédente qui
cassait `cd app && python3 build.py` pour quiconque n'avait pas ce dossier
scratch exact).

Le script vérifie aussi la syntaxe JS (`node --check` sur le script extrait)
et signale si une police a bien été embarquée.

**Pourquoi tout est en base64 inline (polices, images des mascottes) :**
l'app doit fonctionner 100% hors-ligne dans l'APK (aucun réseau), et la
version publiée en Artifact a une CSP qui bloque tous les hôtes externes sauf
Google Fonts. Donc aucune police ni image ne doit être chargée via une URL
externe — tout doit être des data URI.

### Régénérer les polices embarquées

```bash
python3 embed_all_fonts.py
```

Sous-échantillonne (subsetting via `fontTools`) Nunito (400/700/800/900,
depuis `node_modules/@fontsource/nunito`) et BouazziMaghribi (arabe, licence
MIT) pour ne garder que les glyphes réellement utilisés dans le code source,
puis génère `font_face.css`. Attention à préserver les features OpenType
`init/medi/fina/isol` pour que les lettres arabes se lient correctement —
c'était un point de vérification explicite (pas juste "ça s'affiche").

### Régénérer les mascottes (si on retouche les images sources)

Le dossier `mascots/` contient déjà les images finales (rig tête/corps
découpé, fond transparent, pancarte numérotée effacée). Si on repart des
images brutes fournies par l'utilisateur, l'ordre est :

1. `mascots_finalize.py` / `mascots_prepare.py` — nettoyage initial, détourage
2. `mascots_bust.py` — malgré son nom, sa fonction finale est **l'effacement
   de la pancarte numérotée** posée devant chaque personnage (elle ne
   correspondait plus à l'étape réellement affichée). Détection par couleur
   de bordure verte de la pancarte (composantes connexes), filtrage sur la
   moitié droite de l'image pour ne pas confondre avec l'écharpe, puis
   enveloppe convexe (convex hull) du contour détecté = masque à effacer.
   Deux approches plus simples (rectangle fixe, détection d'îlot blanc
   isolé) ont échoué avant celle-ci — voir commentaires dans le fichier.
3. `mascots_rig.py` — découpe chaque personnage en 2 calques articulés
   (tête / corps), coupés au niveau de l'écharpe (seul endroit où la
   jointure ne se voit pas). La tête déborde sous la ligne de coupe (une
   "langue") pour qu'aucun trou n'apparaisse pendant la rotation. Les
   paramètres de coupe/pivot sont dans le dict `RIG` en tête de fichier.

Puis régénérer `app/p4i_mascots.js` (variable `MASCOTS`) à partir des
fichiers `mascots/{nom}_body.webp` / `_head.webp` en base64 + `rig.json`.

**Important — pas d'outil externe pour ça :** j'ai cherché un connecteur
MCP de rigging/animation de personnage (aucun disponible dans le registre) et
testé la segmentation Adobe (`image_select_by_prompt`) pour découper les
oreilles/membres — elle ne comprend que l'anatomie humaine et renvoie un
masque couvrant 99,6% du personnage sur un animal dessiné. D'où le
découpage géométrique manuel en 2 pièces. Aller plus loin (oreilles/queue
articulées indépendamment, clignement des yeux) demanderait soit un
découpage manuel beaucoup plus fin par partie, soit un vrai outil de rig
(ex. Rive ou Spine, import de fichier `.riv`/`.json` avec un runtime JS
dédié) — non fait, laissé en option future.

### Compiler l'APK Android

Pas de Gradle — pipeline manuel (dézipper/remplacer les assets/rezipper/
zipaligner/signer). Il faut le SDK Android (juste `build-tools`, pas besoin
d'Android Studio) pour `zipalign` et `apksigner`.

Étapes generales (à adapter avec les chemins réels du SDK local) :
1. Copier le HTML généré par `build.py` dans `android/assets/index.html`
   (remplace `assets_index_reference.html`, qui n'est qu'une copie de
   référence de l'ancienne version).
2. Compiler les ressources → `res.zip`, générer le `classes.dex` depuis
   `MainActivity.java` (wrapper WebView minimal).
3. Assembler l'APK, `zipalign` (⚠️ `resources.arsc` doit rester **stocké**,
   non compressé, dans le zip — sinon l'installation échoue sur certains
   Android récents).
4. Signer avec `apksigner sign --ks android/keystore/wilayas-v2.jks`.

**Le keystore `wilayas-v2.jks` est le fichier le plus critique de toute
l'archive.** Mot de passe : `wilayasapp2026`. Toutes les versions livrées à
l'utilisateur depuis "v9" sont signées avec cette clé — si l'utilisateur a
déjà installé une version signée par cette clé sur son téléphone, **toute
nouvelle version doit être signée avec la même clé**, sinon Android refuse
la mise à jour (il faut désinstaller puis réinstaller, ce qui perd les
données locales de l'app). Un premier keystore avait déjà été perdu une fois
en cours de session (mot de passe irrécupérable après une coupure de
contexte) — ne pas laisser ça se reproduire, sauvegarder ce fichier ailleurs
aussi si possible.

Le dernier APK livré est inclus tel quel : `android/wilayas-v14.apk`.

### Faire tourner les tests

```bash
npm install --no-save axe-core   # déjà présent dans node_modules si copié
npx playwright install chromium   # si Chromium n'est pas déjà installé localement
node tests/audit_a11y.js
node tests/test_rig.js
```

Les scripts Playwright pointent vers `file:///.../wilaya-v6.html` en dur —
adapter le chemin selon où le fichier généré se trouve localement.

## Architecture de l'app (résumé fonctionnel)

- **Interface bilingue "spine"** : le français est épinglé à gauche, l'arabe
  à droite, en permanence visible (pas un simple toggle de langue).
- **Répétition espacée façon Leitner**, système de cœurs/vies, XP, séries
  (streak), couronnes de progression — mécaniques façon Duolingo.
- **Design tokens CSS** dans `p1_css.css` avec parité clair/sombre stricte :
  bloc `:root` pour le clair, dupliqué sous
  `@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){...}}`
  ET sous `:root[data-theme="dark"]{...}` (pour que le choix explicite de
  thème par l'utilisateur l'emporte dans les deux sens).
- **Mascottes vivantes** : chaque instance (`mascotHtml()` dans
  `p4a_core.js`) a un décalage d'animation propre et irrégulier (pas de
  valeurs rondes) pour éviter l'effet "copié-collé" quand plusieurs
  instances sont visibles en même temps. Une boucle (`mascotBeat()`)
  déclenche aléatoirement de petits gestes (regard, hochement, saut...) sur
  une mascotte visible à la fois, et respecte `prefers-reduced-motion`.
- **Comptes en ligne facultatifs** (`p4k_cloud.js` côté transport,
  `p4l_cloudui.js` côté interface, `server/app.py` côté serveur) : adresse
  e-mail + mot de passe, la progression suit sur tous les appareils. Trois
  règles à ne pas casser : (1) l'app marche à l'identique sans compte et
  sans réseau ; (2) on FUSIONNE avec `mergeInto()` — la même fonction que
  les codes de transfert — on n'écrase jamais ; (3) on ne pousse jamais
  sans avoir lu le serveur d'abord (contrôle de version, 409 + refusion),
  sinon deux appareils utilisés le même jour s'effacent mutuellement.
- **Partage de profil par lien + QR** (piste web, section « Profil &
  synchronisation ») : `exportCode()`/`parseCode()`/`mergeInto()`
  (`p4g_account.js`) existaient déjà pour le copier-coller manuel du code
  `WLY1.<base64url>.<checksum>` ; le code étant déjà en base64url, il tient
  tel quel dans un fragment d'URL (`#w=<code>`), sans encodage
  supplémentaire. `initWebShare()` (`p4h_profileui.js`) construit ce lien,
  propose `navigator.share()` (avec repli sur `navigator.clipboard`), et un
  QR généré 100% côté client via `qr_lib.js` (bibliothèque `qrcode-generator`
  de Kazuhiko Arase, MIT, vendue telle quelle — voir son en-tête pour la
  licence). Au chargement, `checkImportHash()` détecte `#w=...`, nettoie le
  hash (`history.replaceState`) et déclenche la même confirmation/fusion que
  l'import manuel — jamais de fusion silencieuse. Toute cette UI reste
  masquée hors http(s) (`isWebOrigin()`) : un fichier local ou l'APK n'ont
  pas d'adresse à partager, et `navigator.share` n'y existe pas de toute
  façon.
- **Service worker minimal** (`app/sw.js`, enregistré par `p4j_pwa.js`,
  uniquement sur http(s)) : l'app tient dans un seul document, donc un seul
  fichier à mettre en cache — pas de liste d'assets à maintenir.
  Stratégie stale-while-revalidate : sert le cache instantanément, revalide
  en tâche de fond. Voir DEPLOY.md pour le header `Cache-Control` côté
  serveur qui rend ce mécanisme utile (sans lui, un cache HTTP intermédiaire
  peut figer la version que le service worker croit être « le réseau »).

## Pièges déjà rencontrés — ne pas refaire

1. **XSS stocké corrigé** : `esc()` (dans `p4f_i18n.js`) doit échapper
   `& < > " '` — pas seulement `& < >`. Une valeur de profil contenant un
   guillemet pouvait autrement casser un attribut `aria-label="..."` construit
   par concaténation de chaînes et injecter du HTML. Ne jamais revenir à un
   `esc()` qui n'échappe pas les guillemets.
2. **3 défauts WCAG AA trouvés et corrigés** (voir `AUDIT.md` pour le détail) :
   `role="img"` sur `#map-svg` alors qu'il contient 69 boutons interactifs
   réels (corrigé en `role="group"`) ; `.ledger-wrap` inatteignable au
   clavier (ajout de `tabindex="0" role="region"`) ; contraste insuffisant
   sur l'onglet arabe actif à cause d'un `opacity:.9` parasite (supprimé).
3. **Un seul token de couleur `--accent` utilisé à la fois en décoratif ET
   en texte casse le contraste.** D'où la séparation `--accent` (foncé, sûr
   comme texte) / `--accent-bright` (vif, décoratif uniquement — barres de
   progression, confettis). Ne pas fusionner ces deux tokens.
4. **Empiler deux animations CSS (`animation-name`) sur le MÊME élément DOM
   ne fonctionne pas** — la propriété raccourcie `animation` de la classe
   appliquée en second écrase celle du premier. C'est pour ça que la
   respiration continue et les réactions ponctuelles (`beat-*`) sont sur des
   éléments séparés dans la hiérarchie `.mascot-stage > .mascot-breathe >
   .mascot-rig > .rig-head/.rig-body`. Si on ajoute une nouvelle animation à
   une mascotte, lui donner son propre élément, ne pas la poser sur un
   élément qui a déjà une animation en cours.
5. **En modifiant `p2_css_add.css` par script (recherche/remplacement de
   blocs), une suppression accidentelle de CSS peut passer inaperçue** — ça
   m'est arrivé une fois (perte silencieuse de `.mascot-shadow` et de
   plusieurs `@keyframes` lors d'un refactor). Le symptôme était subtil : pas
   d'erreur JS, juste une animation figée. Toujours revérifier avec
   `tests/test_rig.js` / `tests/test_life.js` après une édition CSS
   (ils échantillonnent les transformations calculées dans le temps et
   révèlent un blocage que l'œil peut manquer).
6. **Aucun `<meta charset>` dans le document ne posait problème qu'en
   apparence.** Le HTML n'a ni `<!DOCTYPE>` ni `<html>/<head>/<body>` (tag
   soup volontaire, le navigateur les infère) et fonctionnait très bien en
   `file://` et dans la WebView de l'APK — les deux supposent l'UTF-8 par
   défaut sans balise explicite. Dès que l'app est servie par un serveur
   HTTP qui ne déclare pas `charset=utf-8` dans l'en-tête `Content-Type`
   (ex. `python -m http.server`, et potentiellement d'autres selon leur
   config), tout le texte FR/AR s'affichait en charabia. Corrigé en mettant
   `<meta charset="utf-8">` en toute première ligne de `p0_head.html` —
   ne jamais l'enlever, et ne pas compter sur l'en-tête HTTP du serveur
   pour ce rôle.

7. **Le service worker mettait l'API en cache.** `sw.js` intercepte TOUTES
   les requêtes GET de même origine en stale-while-revalidate. Dès que le
   service de comptes est apparu sous `/api/`, `GET /api/sync` est devenu
   une de ces requêtes : le cache était servi en premier, donc l'app lisait
   une progression périmée en boucle, et les réponses contenant les données
   du compte restaient dans le cache du navigateur après une déconnexion.
   Corrigé par une exclusion explicite (`NO_CACHE_PREFIX = "/api/"`, pas de
   `respondWith` du tout pour ces URL) et le cache renommé en
   `wilaya-shell-v2` pour purger ce qu'une version précédente aurait rangé.
   Verrouillé par un test (`tests/test_cloud_e2e.js`). **Toute nouvelle
   route dynamique devra être exclue de la même façon.**

8. **Une porte modale ne suffit pas à cacher ce qu'il y a derrière.** La
   porte d'entrée (« Qui apprend ? ») recouvre l'app visuellement, mais le
   reste du document restait dans l'arbre d'accessibilité : un lecteur
   d'écran traversait la barre d'onglets et le parcours, y compris avant
   leur premier rendu — donc des boutons vides et sans nom (violation axe
   `button-name`). Corrigé par `setShellHidden()` dans `p4h_profileui.js`,
   qui pose `aria-hidden` sur `.app-shell` tant que la porte est ouverte.

9. **Réutiliser une classe CSS existante réutilise aussi ses
   gestionnaires.** La ligne « Compte en ligne » a d'abord été écrite avec
   `class='profile-row'` pour hériter du style — mais `openProfileSheet()`
   attache un `click` à **tous** les `.profile-row` pour changer de profil,
   et y lit un `data-id` que cette ligne n'a pas. Le sélecteur est devenu
   `.profile-row[data-id]`.

## Où on en était à l'export

**APK (dernière version figée) :** v14, mascottes avec rig articulé
tête/corps (fini, vérifié, livré), 0 violation d'accessibilité automatisée,
XSS corrigé et re-vérifié à chaque reconstruction. Rien de technique n'était
en attente sur ce front — la suite logique, si on va plus loin sur
l'animation, serait un découpage manuel plus fin (oreilles/queue séparées)
ou un vrai moteur de rig (Rive/Spine).

**Piste actuelle : web uniquement, l'APK est mis de côté pour l'instant.**
Ajoutés dans cette passe : service worker + PWA installable, partage de
profil par lien/QR (voir plus haut), mnémotechniques pour les 21 wilayas de
2019/2025 (`HOOKS` dans `part_data.js`, codes 49–69 — auparavant seuls les
codes 1–48 en avaient), et le correctif de charset ci-dessus (bloquant pour
tout hébergement web).

**En ligne depuis le 2026-09-11 : https://69.smnc.win** (vérifié en
production). Runner GitHub Actions self-hosted installé sur `bigpc` (label
`bigpc`) — `deploy/` se reconstruit tout seul via
`.github/workflows/deploy.yml` à chaque push touchant `app/` ou `deploy/`,
déclenchable aussi à la demande. Port du conteneur : `8099` (8090-8093/8095
étaient déjà pris par d'autres services de `bigpc`). Routage `cloudflared`
fait à la main, en CNAME direct dans le dashboard Cloudflare — la commande
`cloudflared tunnel route dns` s'est révélée cassée pour ce compte (écrit
dans la mauvaise zone, voir piège dans DEPLOY.md). Voir **DEPLOY.md** pour
le runbook complet, à jour de ce qui a réellement marché.
