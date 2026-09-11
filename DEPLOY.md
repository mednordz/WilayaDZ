# Déploiement web — 69.smnc.win

Objectif : servir l'app en continu sur `https://69.smnc.win`, hébergée sur
`bigpc`, derrière le tunnel Cloudflare existant `smnc-portal-tunnel` — le
même mécanisme que `wa.smnc.win` (voir le dépôt `YtSMNC`, section
« Cloudflare Tunnel » de son README, pour le détail de cette
architecture).

⚠️ **Cette session Claude Code tourne dans un conteneur cloud isolé, sans
accès réseau à `bigpc`** (pas de SSH, pas de Tailscale, pas de runner
GitHub self-hosted détecté dans ce dépôt). Tout ce qui suit a été préparé
et testé jusqu'où c'était possible depuis cet environnement (build,
Dockerfile, contenu servi), mais les commandes de cette page doivent être
lancées **par quelqu'un qui a un accès shell à `bigpc`** — toi, ou une
future session Claude Code à qui cet accès aurait été donné explicitement
(clé SSH joignable, runner self-hosted, etc.).

## 1. Construire et lancer le conteneur

Sur `bigpc`, dans une copie du dépôt `wilaya-01-69` :

```bash
docker compose -f deploy/docker-compose.yml up -d --build
curl -s http://127.0.0.1:8092/ | head -c 200   # doit renvoyer le HTML, en UTF-8 lisible
```

Si le port `8092` est déjà pris par autre chose sur `bigpc`, changer le
mappage dans `deploy/docker-compose.yml` (`"127.0.0.1:<PORT>:8080"`) et
adapter la route ci-dessous en conséquence.

## 2. Router 69.smnc.win vers ce conteneur

Ajouter dans **`/etc/cloudflared/config.yml`** (pas `~/.cloudflared/config.yml`,
qui existe aussi mais n'est pas celle utilisée par le service systemd) :

```yaml
  - hostname: 69.smnc.win
    service: http://127.0.0.1:8092
```

Puis :

```bash
cloudflared tunnel route dns smnc-portal-tunnel 69.smnc.win
systemctl restart cloudflared
systemctl status cloudflared   # PAS smnc-portal-tunnel, voir README YtSMNC
```

## 3. Vérifier en conditions réelles

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

## Mettre à jour après un nouveau `git pull`

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

Le service worker des téléphones déjà visités verra la nouvelle version
au chargement suivant (stale-while-revalidate), sans action de leur part.
