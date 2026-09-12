# Déploiement web — wilayadz.smnc.win

Objectif : servir l'app en continu sur `https://wilayadz.smnc.win`
(`69.smnc.win` reste actif, pour ne casser aucun lien déjà partagé),
hébergée sur `bigpc`, derrière le tunnel Cloudflare existant
`smnc-portal-tunnel` — le même mécanisme que `wa.smnc.win` (voir le dépôt
`YtSMNC`, section « Cloudflare Tunnel » de son README, pour le détail de
cette architecture).

## Ce qui tourne

Deux conteneurs, décrits par `deploy/docker-compose.yml` :

| Conteneur | Rôle | Exposition |
|---|---|---|
| `wilaya-web` | nginx : sert l'app (un seul `index.html`) et **relaie `/api/`** | `127.0.0.1:8099` |
| `wilaya-api` | comptes et synchronisation (`server/app.py`) | **aucune** — réseau interne seulement |

`wilaya-api` n'a volontairement pas de `ports:` : il n'est joignable que
par `wilaya-web`. C'est ce qui rend acceptable d'y faire tourner
`http.server` — il ne voit jamais l'internet en direct, seulement des
requêtes déjà filtrées par nginx, lui-même derrière le tunnel.

Les opérations de production sont décrites dans **[PRODUCTION.md](PRODUCTION.md)** :
archives SQLite chiffrées sur Google Drive, contrôle de restauration, surveillance,
prévalidation isolée et retour aux images précédentes. Le volume réel vérifié
sur bigpc est `deploy_wilaya-data`, monté à `/data` dans l'API.
Ne pas copier directement une base SQLite active ni supposer le nom du volume.

Les étapes 0 et 2 ne se font qu'**une seule fois**, à la main sur `bigpc` :
elles touchent l'auth GitHub et la configuration du tunnel, partagée avec
`wa.smnc.win`. Elles sont faites. L'étape 1 — reconstruire et relancer les
conteneurs à chaque changement — est automatisée par
`.github/workflows/deploy.yml` sur un runner GitHub Actions self-hosted,
déclenchable aussi à la main (`workflow_dispatch`).

Une troisième chose se règle sur `bigpc` et non dans ce dépôt : l'envoi
des courriels, qui passe par le postfix de la machine (voir « Mot de passe
oublié » plus bas).

## 0. Mise en place unique du runner (à faire une fois, sur bigpc)

1. Ouvrir **https://github.com/mednordz/WilayaDZ/settings/actions/runners/new**
   (choisir Linux / x64) — cette page génère les commandes `curl`/`tar`/
   `config.sh` avec un jeton d'enregistrement valide (~1h), copiées-collées
   telles quelles sur `bigpc`.
2. À l'étape `./config.sh`, ajouter le label `bigpc` quand c'est demandé
   (ou en argument : `--labels bigpc`) — c'est ce label que vise
   `runs-on: [self-hosted, bigpc]` dans le workflow.
3. L'installer comme service systemd plutôt que de le laisser tourner dans
   un terminal (survit aux redémarrages de `bigpc`) :
   ```bash
   sudo ./svc.sh install
   sudo ./svc.sh start
   sudo ./svc.sh status
   ```
4. Vérifier qu'il apparaît « Idle » dans Settings → Actions → Runners.

Le runner n'a besoin que de `docker` et `docker compose` (déjà présents sur
`bigpc`, utilisés par `YtSMNC`) et d'un accès en lecture au dépôt — rien de
plus large. Révocable à tout moment depuis cette même page GitHub.

## 1. Construire et lancer le conteneur (automatisé une fois le runner en place)

Le workflow exécute les contrôles complets sur un runner GitHub hébergé, puis
`python3 deploy/release.py "$GITHUB_SHA"` sur bigpc. Il construit les images,
les vérifie sur un réseau isolé avec une base jetable, attend une sauvegarde
vérifiée, puis publie et vérifie la version exacte. En cas d'échec, il revient
à la configuration précédente sans restaurer automatiquement la base.

Seule la branche `main` peut publier, y compris en lancement manuel. La procédure
initiale et le retour manuel sont documentés dans [PRODUCTION.md](PRODUCTION.md).

Si le port `8099` est déjà pris par autre chose sur `bigpc`, changer le
mappage dans `deploy/docker-compose.yml` (`"127.0.0.1:<PORT>:8080"`) et
adapter la route ci-dessous en conséquence.

## 2. Router le nom de domaine vers ce conteneur (fait, sur bigpc)

Laissé en manuel volontairement : ça touche `/etc/cloudflared/config.yml`,
un fichier **partagé** avec `wa.smnc.win` (le bot WhatsApp en production) —
pas quelque chose à faire éditer par une automatisation sans supervision,
même une seule fois.

État actuel (posé le 2026-09-11, sauvegarde préalable du fichier,
`cloudflared tunnel ingress validate` → OK) — **`/etc/cloudflared/config.yml`**
(pas `~/.cloudflared/config.yml`, qui existe aussi mais n'est pas celle
utilisée par le service systemd) :

```yaml
  - hostname: wilayadz.smnc.win
    service: http://127.0.0.1:8099
  - hostname: 69.smnc.win
    service: http://127.0.0.1:8099
```

Les deux noms pointent volontairement sur le même conteneur : `69.smnc.win`
est conservé pour ne casser aucun lien déjà partagé. Rien à faire de plus
pour l'API — elle passe par le même nginx, sur `/api/`.

Puis :

```bash
systemctl restart cloudflared
systemctl status cloudflared   # PAS smnc-portal-tunnel, voir README YtSMNC
```

⚠️ **`cloudflared tunnel route dns smnc-portal-tunnel 69.smnc.win` NE MARCHE
PAS sur ce compte** — vérifié le 2026-09-11 : la commande répond « Added
CNAME 69.smnc.win.**smnc-dz.com** » (l'ancien domaine, retiré, pas
`smnc.win`) et crée l'enregistrement dans la mauvaise zone. Cause
probable : l'auth locale de `cloudflared` (`~/.cloudflared/cert.pem`) reste
scopée sur `smnc-dz.com` depuis avant la migration de domaine (2026-09-06)
et n'a jamais été rafraîchie pour `smnc.win`. Ne pas relancer cette
commande pour un futur sous-domaine sans d'abord vérifier où elle écrit
(chercher le nouveau nom dans le dashboard Cloudflare juste après).

**À la place, créer le DNS à la main** dans le dashboard Cloudflare :
`smnc.win` → DNS → Records → **Ajouter un enregistrement** :
- Type : `CNAME`
- Nom : le sous-domaine seul (`wilayadz`, `69`…) — Cloudflare ajoute
  `.smnc.win` tout seul
- Cible : `6923c9e9-9586-49f6-82d9-47f46e78dbb2.cfargotunnel.com` (l'ID du
  tunnel `smnc-portal-tunnel`, visible aussi dans `config.yml` ligne 1)
- Statut proxy : **Proxied** (nuage orange)

C'est exactement ce que `route dns` aurait dû créer — juste fait à la main,
dans la bonne zone. Vérifié en production le 2026-09-11 : fonctionne.

## 3. Vérifier en conditions réelles

⚠️ Depuis une session Claude Code cloud, ces `curl` échouent avec un 403
qui vient du **proxy sortant du sandbox lui-même** (pas de Cloudflare ni
du site) — politique réseau propre à cet environnement, sans rapport avec
le déploiement. Les lancer depuis `bigpc` ou un poste normal.

```bash
curl -sI https://wilayadz.smnc.win/ | grep -i content-type  # peu importe le charset ici :
                                                            # <meta charset="utf-8"> dans le
                                                            # HTML fait foi quoi qu'il arrive
curl -s  https://wilayadz.smnc.win/sw.js | head -c 100
curl -s  https://wilayadz.smnc.win/api/health                # doit renvoyer {"ok": true}
curl -sI https://69.smnc.win/ | head -1                      # l'ancien lien doit vivre
```

Puis depuis un téléphone : ouvrir `https://wilayadz.smnc.win`, créer un
profil, vérifier que l'app fonctionne, couper le réseau et recharger (doit
continuer à s'afficher — c'est le service worker). Tester aussi
« Partager un lien » / « Code QR » dans Infos → Profil & synchronisation.

Et pour les comptes, le seul essai qui prouve quelque chose : créer un
compte sur un téléphone, se connecter avec sur un **autre** appareil, et
vérifier que la progression est bien là.

## 4. Comptes et synchronisation

Un compte (adresse e-mail + mot de passe) rattache un profil au serveur :
la même progression se retrouve sur n'importe quel appareil où l'on se
connecte.

**Le compte est obligatoire** pour se servir de l'application — mais il
n'est exigé qu'**une seule fois**, à l'inscription ou à la connexion.
Ensuite la session reste sur l'appareil et tout fonctionne hors ligne
(PWA installée, APK, avion), la synchronisation reprenant d'elle-même au
retour du réseau. Une panne du service de comptes n'empêche donc jamais
de réviser — c'est vérifié à chaque déploiement.

Un profil créé **avant** les comptes n'est pas perdu : la porte d'entrée
le signale « à rattacher », et l'inscription (ou la connexion) envoie sa
progression sur le compte au lieu de la remplacer.

Routes, toutes sous `/api` :

| Route | Effet |
|---|---|
| `GET /config` | ce que l'app doit savoir avant d'afficher quoi que ce soit |
| `POST /auth/google` | connexion par Google — crée le compte au besoin |
| `POST /auth/register` | ouvre un compte **non confirmé** — 202, aucun jeton |
| `POST /auth/confirm` | confirme l'adresse et ouvre une session |
| `POST /auth/resend` | renvoie le lien de confirmation — **toujours 204** |
| `POST /auth/login` | ouvre une session — **403 `not_verified`** si l'adresse ne l'est pas |
| `POST /auth/logout` | ferme **cette** session seulement |
| `POST /auth/password` | change le mot de passe et ferme les autres appareils |
| `POST /auth/forgot` | envoie un lien de réinitialisation — **toujours 204** |
| `POST /auth/reset` | pose un nouveau mot de passe et ouvre une session |
| `GET /me` | le compte courant |
| `GET /sync` · `PUT /sync` | lire / écrire la progression |
| `DELETE /account` | supprime le compte (mot de passe exigé) |
| `GET /health` | sonde du healthcheck (répond aussi en `HEAD`) |

Ce qui protège quoi :

- **Mots de passe** : `hashlib.scrypt` (n=2¹⁴, r=8, p=1), sel aléatoire
  de 16 octets par compte, comparaison en temps constant. Jamais stockés
  ni journalisés en clair.
- **Jetons de session** : 32 octets tirés de `secrets`, dont la base ne
  garde qu'une empreinte SHA-256 — une copie du fichier SQLite ne permet
  de se faire passer pour personne. Transmis par en-tête `Authorization`,
  jamais par cookie : il n'y a donc pas de CSRF à traiter, et l'APK
  (origine `null`) peut se synchroniser.
- **Débit** : 8 créations de compte par heure et par IP, 10 connexions
  par quart d'heure. Une adresse inexistante coûte le même temps qu'une
  vraie, pour ne pas révéler qui a un compte ici.
- **Écritures concurrentes** : chaque envoi déclare la version sur
  laquelle il a fusionné ; si le serveur a bougé entre-temps il répond
  409 avec son état, et le client refusionne. Deux appareils utilisés le
  même jour convergent au lieu de s'effacer.
- **Fusion, jamais écrasement** : côté client, exactement la même
  fonction que les codes de transfert (`mergeInto`) — pour chaque wilaya,
  la meilleure des deux mémoires gagne.

### Se connecter avec Google

**En place depuis le 2026-09-12.** Projet Google Cloud **`wilayadz`**
(distinct de `youtube-auto-uploader-2` : l'écran de consentement est
propre au projet, et c'est son nom que Google montre aux gens — voir
« WilayaDZ » et non le nom d'une autre application).

| | |
|---|---|
| Client OAuth | `WilayaDZ Web`, type Application Web |
| Origines JavaScript | `https://wilayadz.smnc.win` et `https://69.smnc.win` |
| URI de redirection | les mêmes **avec la barre oblique finale** |
| État de publication | **En production** (2026-09-12) |

⚠️ **L'ancien domaine est enregistré lui aussi** : `69.smnc.win` répond
toujours, et sans ses deux URL quelqu'un qui ouvre l'app par ce lien
verrait le bouton Google échouer.

**Aucune validation par Google n'a été nécessaire**, et il ne faut pas
que cela change : la revue de Google — celle qui prend des semaines —
ne s'applique qu'aux applications demandant des accès *sensibles*
(lire les courriels, Drive, l'agenda) ou déclarant plus de 10 domaines
ou un logo. WilayaDZ ne demande que `openid`, `email` et `profile`,
classés non sensibles.

⚠️ **Ne pas importer de logo dans Branding** et ne pas élargir les
portées : l'un comme l'autre déclenchent la validation, et l'application
retomberait en accès restreint le temps de l'examen.

Publier a exigé deux pages publiques, désormais servies par le même
nginx (`deploy/pages/`) :

| | |
|---|---|
| `https://wilayadz.smnc.win/confidentialite` | ce qui est gardé, où, combien de temps |
| `https://wilayadz.smnc.win/conditions` | les règles d'usage |

Elles sont bilingues, lisibles sans compte, liées depuis la porte
d'inscription, et écrites à partir des faits vérifiés du déploiement —
pas d'un modèle recopié. **Si le fonctionnement change (durées de
conservation, hébergeur, tiers), ces pages doivent changer avec.**

Le code secret du client n'est **ni utilisé ni stocké** : la redirection
rapporte directement un jeton d'identité, il n'y a pas de code à
échanger côté serveur. Il n'a donc pas à se trouver dans ce dépôt.

Pour refaire la manipulation (autre domaine, autre projet) :

1. [console.cloud.google.com](https://console.cloud.google.com/) → créer
   un projet **dédié** ;
2. **APIs & Services → OAuth consent screen** : type « External »,
   renseigner le nom de l'app et l'adresse de contact ;
3. **APIs & Services → Credentials → Create credentials → OAuth client
   ID**, type **Web application** ;
4. dans **Authorized JavaScript origins** : `https://wilayadz.smnc.win`
5. dans **Authorized redirect URIs** : `https://wilayadz.smnc.win/`
   — **avec la barre oblique finale**, c'est exactement ce que
   l'application envoie (`location.origin + location.pathname`) ;
6. copier l'identifiant (`…apps.googleusercontent.com`) dans
   `deploy/docker-compose.yml`, service `wilaya-api` :

   ```yaml
       environment:
         GOOGLE_CLIENT_ID: "xxxxx.apps.googleusercontent.com"
   ```

7. pousser : le déploiement reconstruit et le bouton apparaît.

Ce n'est pas un secret — un identifiant client OAuth est public par
construction, il est visible dans l'URL de redirection. Ce qui protège,
c'est que le service vérifie que le jeton a bien été **émis pour nous**
(`aud`), sans quoi un jeton obtenu par n'importe quelle autre
application Google ouvrirait un compte ici.

Le jeton est vérifié **auprès de Google** (`oauth2.googleapis.com/tokeninfo`)
plutôt que localement : vérifier une signature RS256 demanderait une
bibliothèque de cryptographie, et ce service tient à n'en avoir aucune.
Une adresse Google étant déjà vérifiée, **ces comptes n'ont pas d'étape
de confirmation**.

Côté application, aucun script de Google n'est chargé : la redirection
OAuth suffit. L'app reste un fichier autonome, et personne n'est suivi
par Google pour avoir simplement ouvert l'application.

### Confirmation de l'adresse

**L'inscription ne donne rien tant que l'adresse n'est pas confirmée** :
`register` répond 202 sans aucun jeton, et `login` refuse avec
`not_verified`. C'est ce qui empêche d'ouvrir un compte avec l'adresse de
quelqu'un d'autre — et, surtout, ce qui évite qu'une faute de frappe
produise un compte **irrécupérable** : le lien de mot de passe oublié
partirait vers une boîte qu'on ne relève pas.

Le lien vaut **24 heures** (on ne relève pas forcément ses mails dans
l'heure, et c'est le tout premier geste). Le confirmer ouvre la session
dans la foulée : la personne vient de prouver qu'elle relève cette boîte,
lui redemander de se connecter n'apprendrait rien à personne.

Deux garde-fous qui comptent :

- Se réinscrire par-dessus une inscription **jamais confirmée** la
  remplace (nouveau mot de passe, nouveau lien, l'ancien meurt). Sans
  cela, une faute de frappe sur l'adresse d'un tiers bloquerait cette
  adresse pour toujours. Un compte **confirmé**, lui, est intouchable :
  409.
- Une inscription jamais confirmée est effacée au bout de **7 jours**,
  ce qui libère l'adresse.

Côté application, tant que la confirmation n'a pas eu lieu : aucun profil
local n'est créé, rien n'est rattaché, et la progression déjà présente
sur l'appareil reste intacte. Un code d'accès local choisi à
l'inscription est gardé sous forme d'**empreinte** (jamais le code), et
le profil la reprend en naissant.

### Mot de passe oublié

`POST /auth/forgot` répond **204 quoi qu'il arrive** : adresse inconnue,
mal formée, quota atteint, serveur de mail en panne. Une réponse qui
différerait ferait de cette porte un moyen de savoir qui a un compte
ici. L'interface dit donc elle aussi exactement la même chose dans tous
les cas — « si un compte existe avec cette adresse… ».

Le jeton voyage dans le **fragment** de l'URL
(`https://wilayadz.smnc.win/#reset=…`) : un fragment n'est jamais envoyé
au serveur, donc il n'apparaît ni dans les journaux d'accès de nginx, ni
dans ceux de Cloudflare. L'application l'efface de la barre d'adresse dès
qu'elle l'a lu. Il vaut **une heure**, ne sert **qu'une fois**, et sa
consommation déconnecte tous les appareils du compte — c'est le geste
qu'on fait précisément quand on craint que quelqu'un d'autre soit entré.

**Comment le courriel part.** `wilaya-api` remet le message au **postfix
déjà installé sur bigpc**, qui relaie vers Gmail — le même chemin que les
alertes de la machine. Aucun mot de passe n'est donc stocké dans ce
déploiement.

**Trois** choses doivent rester d'accord, sans quoi l'envoi s'arrête en
silence :

1. `deploy/docker-compose.yml` fige l'adresse du conteneur à
   **`172.28.0.10`** (sous-réseau `172.28.0.0/16`) ;
2. le `mynetworks` de `/etc/postfix/main.cf` sur bigpc autorise
   **exactement cette adresse** :

   ```
   mynetworks = 127.0.0.0/8 … 10.10.10.25/32 172.28.0.10/32
   ```

   Posé le 2026-09-11 (sauvegarde `main.cf.bak-20260911-230757`,
   `postfix check` OK, `systemctl reload postfix`). Une seule ligne
   ajoutée — vérifiée par `diff` contre la sauvegarde ;
3. **ufw** laisse passer cette adresse vers le port 25 — sans quoi la
   connexion expire sans que postfix voie jamais rien (c'est exactement
   ce qui est arrivé au premier essai) :

   ```
   25/tcp   ALLOW   172.28.0.10   # WilayaDZ API -> postfix local
   ```

   Même forme que les trois règles `relais SMTP` déjà présentes pour
   `smnc`, `mrdell` et `proxmox`.

### L'adresse d'expéditeur

Les deux courriels — confirmation et mot de passe oublié — partent par
le même chemin et le même gabarit (`build_mail`).

`MAIL_FROM` vaut **`WilayaDZ <bigpc.alg@gmail.com>`** : le compte sous
lequel le relais s'authentifie réellement. Ce n'est pas un détail
cosmétique — la zone `smnc.win` n'a **ni SPF ni DMARC**, donc un
expéditeur en `@smnc.win` serait invérifiable et finirait dans les
indésirables. Un courriel de réinitialisation qui n'arrive pas ne sert à
rien. Pour un expéditeur aux couleurs du domaine, publier d'abord SPF et
DKIM pour `smnc.win`, puis changer `MAIL_FROM`.

Si les courriels cessent de partir, regarder dans cet ordre :

```bash
docker logs wilaya-api --tail 30 | grep -i mail      # « echec d'envoi » ?
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' wilaya-api
sudo postconf -h mynetworks                          # les deux doivent concorder
sudo tail -20 /var/log/mail.log
```

Sans `SMTP_HOST`, le service n'envoie rien et se contente de journaliser
le lien : c'est le mode de mise au point, jamais la production.

Éprouver le service sans rien déployer :

```bash
python3 tests/test_api.py              # 111 vérifications, service jetable + faux SMTP
python3 tests/serve_test.py 8390 &     # l'app + son API sur une même origine
node tests/test_cloud_e2e.js           # 59 : confirmation, migration, avatar, mot de passe oublié
node tests/audit_a11y_cloud.js         # 22 écrans de compte audités
node tests/test_gate_scroll.js         # défilement des portes, clavier ouvert (sans serveur)
```

## Pourquoi ces choix

- **nginx:alpine + un build multi-étage** (`deploy/Dockerfile`) : l'image
  reconstruit `index.html` et `sw.js` à partir de `app/` à chaque build,
  jamais un fichier généré à la main qu'on oublierait de rafraîchir.
- **`Cache-Control: no-cache`** sur `index.html` et `sw.js` (voir
  `deploy/nginx.conf`) : le service worker applicatif fait déjà du
  stale-while-revalidate (`app/sw.js`) — sans ce header, un cache HTTP
  intermédiaire pourrait servir une version figée à ce mécanisme et
  bloquer toute mise à jour perçue par les utilisateurs.
- **`<meta charset="utf-8">`** ajouté en tout premier dans `app/p0_head.html` :
  bug découvert pendant ce travail — l'app (FR/AR) s'affichait en charabia
  dès qu'elle était servie par un serveur HTTP qui ne déclare pas
  explicitement l'UTF-8 (ex. `python -m http.server`), alors qu'elle avait
  toujours fonctionné en `file://` et dans l'APK (qui, eux, supposent
  l'UTF-8 par défaut). Sans ce correctif, la mise en ligne aurait été
  cassée dès le premier chargement.
- **Port lié à `127.0.0.1` uniquement** : même principe que les autres
  services de `bigpc` (voir `wa.smnc.win` dans `YtSMNC`) — aucun port
  exposé au LAN ni au routeur, seul le tunnel Cloudflare y accède.
- **Runner self-hosted plutôt qu'un accès SSH direct** : scope minimal
  (juste ce dépôt), révocable en un clic depuis GitHub, jamais
  d'identifiants `bigpc` à faire transiter ou stocker ailleurs.
- **La config `cloudflared` reste manuelle** : c'est un fichier partagé
  avec un service en production (`wa.smnc.win`) — une automatisation qui
  peut le réécrire sans supervision est un risque disproportionné pour un
  geste qui ne se fait qu'une fois.
- **Le service de comptes n'utilise que la bibliothèque standard de
  Python** : pas de `requirements.txt`, pas de chaîne d'approvisionnement
  à surveiller, et un fichier qu'on peut relire d'un bout à l'autre — le
  seul moyen honnête d'auditer soi-même du code qui manipule des mots de
  passe. Tout ce qu'il faut y est déjà : `hashlib.scrypt`, `secrets`,
  `hmac.compare_digest`, `sqlite3`.
- **SQLite plutôt qu'un serveur de base de données** : quelques dizaines
  de comptes et une écriture par session de révision. Un PostgreSQL
  serait un service de plus à faire tourner, surveiller et sauvegarder
  sur une machine qui héberge déjà Plex, Immich, Ollama et une VM. Un
  fichier unique se sauvegarde en le copiant.
- **Le service worker ignore `/api/`** : il intercepte tous les GET de
  même origine ; sans exclusion explicite il servirait une progression
  périmée depuis le cache, en boucle, et laisserait les données du compte
  dans le cache du navigateur après une déconnexion. Vérifié par
  `tests/test_cloud_e2e.js`.

## Mettre à jour après un nouveau `git pull`

Automatique dès qu'un push sur `main` touche `app/` ou `deploy/` (le
workflow s'en charge). Manuellement si besoin :

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

Le service worker des téléphones déjà visités verra la nouvelle version
au chargement suivant (stale-while-revalidate), sans action de leur part.
