# Déploiement web — 69.smnc.win

Objectif : servir l'app en continu sur `https://69.smnc.win`, hébergée sur
`bigpc`, derrière le tunnel Cloudflare existant `smnc-portal-tunnel` — le
même mécanisme que `wa.smnc.win` (voir le dépôt `YtSMNC`, section
« Cloudflare Tunnel » de son README, pour le détail de cette
architecture).

⚠️ **Cette session Claude Code tourne dans un conteneur cloud isolé, sans
accès réseau à `bigpc`** (pas de SSH, pas de Tailscale) : aucune commande
de cette page n'a pu être exécutée depuis cet environnement. Deux étapes
sont **à faire une seule fois, à la main, sur `bigpc`** (0. et 2. — elles
touchent l'auth GitHub et la config partagée du tunnel, utilisée aussi par
`wa.smnc.win`) ; ensuite, l'étape 1 (construire/relancer le conteneur à
chaque changement) est automatisée par `.github/workflows/deploy.yml` sur
un runner GitHub Actions self-hosted, et Claude Code peut la déclencher
lui-même (`workflow_dispatch`) sans plus rien te redemander.

## 0. Mise en place unique du runner (à faire une fois, sur bigpc)

1. Ouvrir **https://github.com/mednordz/wilaya-01-69/settings/actions/runners/new**
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

Le workflow `.github/workflows/deploy.yml` fait tourner, sur ce runner,
exactement :

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

à chaque push sur `main` touchant `app/` ou `deploy/`, et sur demande
manuelle. En secours (runner en panne, ou avant qu'il existe), la même
commande marche lancée à la main sur `bigpc` :

```bash
docker compose -f deploy/docker-compose.yml up -d --build
curl -s http://127.0.0.1:8099/ | head -c 200   # doit renvoyer le HTML, en UTF-8 lisible
```

Si le port `8099` est déjà pris par autre chose sur `bigpc`, changer le
mappage dans `deploy/docker-compose.yml` (`"127.0.0.1:<PORT>:8080"`) et
adapter la route ci-dessous en conséquence.

## 2. Router 69.smnc.win vers ce conteneur (à faire une fois, sur bigpc)

Laissé en manuel volontairement : ça touche `/etc/cloudflared/config.yml`,
un fichier **partagé** avec `wa.smnc.win` (le bot WhatsApp en production) —
pas quelque chose à faire éditer par une automatisation sans supervision,
même une seule fois.

Ajouter dans **`/etc/cloudflared/config.yml`** (pas `~/.cloudflared/config.yml`,
qui existe aussi mais n'est pas celle utilisée par le service systemd) :

```yaml
  - hostname: 69.smnc.win
    service: http://127.0.0.1:8099
```

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
- Nom : `69` (juste le sous-domaine, Cloudflare ajoute `.smnc.win` tout seul)
- Cible : `6923c9e9-9586-49f6-82d9-47f46e78dbb2.cfargotunnel.com` (l'ID du
  tunnel `smnc-portal-tunnel`, visible aussi dans `config.yml` ligne 1)
- Statut proxy : **Proxied** (nuage orange)

C'est exactement ce que `route dns` aurait dû créer — juste fait à la main,
dans la bonne zone. Vérifié en production le 2026-09-11 : fonctionne.

## 3. Vérifier en conditions réelles

⚠️ Depuis une session Claude Code cloud, ces `curl` vers `69.smnc.win`
échouent avec un 403 qui vient du **proxy sortant du sandbox lui-même**
(pas de Cloudflare ni du site) — politique réseau propre à cet
environnement, sans rapport avec le déploiement. Les lancer depuis `bigpc`
ou un poste normal.

```bash
curl -sI https://69.smnc.win/ | grep -i content-type   # peu importe le charset ici :
                                                         # <meta charset="utf-8"> dans le
                                                         # HTML fait foi quoi qu'il arrive
curl -s https://69.smnc.win/sw.js | head -c 100
```

Puis depuis un téléphone : ouvrir `https://69.smnc.win`, créer un profil,
vérifier que l'app fonctionne, couper le réseau et recharger (doit
continuer à s'afficher — c'est le service worker). Tester aussi
« Partager un lien » / « Code QR » dans Infos → Profil & synchronisation.

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

## Mettre à jour après un nouveau `git pull`

Automatique dès qu'un push sur `main` touche `app/` ou `deploy/` (le
workflow s'en charge). Manuellement si besoin :

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

Le service worker des téléphones déjà visités verra la nouvelle version
au chargement suivant (stale-while-revalidate), sans action de leur part.
