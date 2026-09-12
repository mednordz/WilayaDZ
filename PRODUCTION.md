# Exploitation de WilayaDZ

## Emplacements vérifiés le 12 septembre 2026

| Élément | Emplacement |
|---|---|
| Code local | `/Users/mednor/Downloads/wilayas-project` |
| Dépôt public | `github.com/mednordz/WilayaDZ` |
| Checkout du runner bigpc | `/home/mednor/actions-runner/_work/WilayaDZ/WilayaDZ` |
| Base active sur bigpc | `/var/lib/docker/volumes/deploy_wilaya-data/_data/wilayadz.sqlite3` |
| Base vue par le service API | `/data/wilayadz.sqlite3` |
| Point d'entrée local | `http://127.0.0.1:8099` |

La destination choisie est Google Drive, dans un dossier privé « WilayaDZ — Sauvegardes ».
Aucune sauvegarde NAS n’est activée par ce dispositif.
Le tunnel Cloudflare et Postfix sont partagés avec d'autres applications.
La présente optimisation ne change ni leur configuration ni le sous-réseau
de l'API (`172.28.0.10`, autorisé par Postfix).

## Installation du dispositif de sauvegarde et surveillance

Une première archive chiffrée réelle a été déposée sur Google Drive le 12 septembre
2026 via le connecteur Codex, avec restauration locale préalable, vérification de
présence, taille et accès privé sur Drive. Le reçu et la copie chiffrée sont dans
`.local-ops/` sur le Mac. La clé privée est copiée sur ce Mac et sur bigpc.

**Sauvegardes automatiques actives depuis le 12 septembre 2026 à 14 h 24** :
connexion rclone `smncdrive` renouvelée avec le périmètre `drive.file` ;
dossier privé « WilayaDZ - Sauvegardes automatiques » créé par rclone et vérifié
dans le même Drive que la première sauvegarde Codex. Ce dossier distinct évite
d’élargir les permissions aux autres fichiers de l’utilisateur.

La sauvegarde réelle a été envoyée, retéléchargée, comparée à l’archive source
et restaurée avec succès, aussi via systemd. Les deux timers sont activés et
le premier contrôle local de santé est vert. Les archives et rapports restent
hors Git, comme la configuration privée `/etc/wilayadz/drive.json`.

Cette configuration contient `remote`, `folder_id` et `rclone_config`
(chemin de la configuration OAuth dédiée, privée, en 0600). Les appels rclone
visent le dossier choisi avec `--drive-root-folder-id`, sans synchronisation
destructive du Drive. Pour une réinstallation, reconnecter Google et vérifier
ces éléments avant les commandes ci-dessous. Si Google demande de configurer
un Shared Drive, répondre non : le stockage utilisé est Mon Drive.

Sur bigpc, depuis le checkout validé :

```bash
sudo bash deploy/ops/install.sh
sudo systemctl start wilayadz-backup.service
sudo systemctl start wilayadz-monitor.service
sudo cat /var/lib/wilayadz-ops/backup-status.json
sudo cat /var/lib/wilayadz-ops/health-status.json
systemctl list-timers 'wilayadz-*'
```

La clé est créée une seule fois dans `/etc/wilayadz/backup.key`, lisible uniquement
par root. Conserver une copie de récupération privée sur le Mac, hors Git,
dans `.local-ops/backup.key` (répertoire 0700, fichier 0600). Ne jamais afficher
la clé dans la conversation, les logs, GitHub ou les captures.

Le dispositif utilise l'[API de sauvegarde SQLite](https://docs.python.org/3/library/sqlite3.html#sqlite3.Connection.backup)
pour capturer aussi les écritures WAL, sans arrêter l'application. Il vérifie
l'intégrité et les relations, chiffre avec GPG/AES256, puis conserve :

- 7 dernières archives sur bigpc : `/var/lib/wilayadz-ops/archives` ;
- 30 dernières archives dans le dossier Google Drive dédié ; les plus anciennes
  sont placées dans la corbeille de Drive après réussite d’une nouvelle copie.

Il relit l'archive depuis Google Drive, la déchiffre dans un répertoire temporaire LOCAL,
vérifie l'intégrité et l'identité exacte avec le snapshot, puis efface les fichiers
temporaires. Seules les archives chiffrées quittent bigpc. Le rapport ne contient
ni compte ni progression. Une connexion Drive expirée, un envoi échoué ou une
archive relue différente provoque un échec et ne valide pas une nouvelle sauvegarde. Les anciennes archives ne sont élaguées
qu'après réussite de toute l'opération.

Sauvegarde quotidienne vers 03 h 45 (heure de bigpc), rattrapée après redémarrage,
et avant chaque publication. Il s'agit de 30 **copies**, pas de 30 jours garantis.
La perte maximale entre copies quotidiennes peut approcher 24 heures.
Google Drive apporte une copie hors de bigpc, mais elle n’est pas immuable.
La clé conservée seulement sur bigpc ne permettrait pas de récupérer les archives
après perte de cette machine : la copie de récupération est indispensable.

## Publication

1. Branche `codex/...`, contrôles locaux `npm test`, puis proposition de mise à jour
   (PR) pour les contrôles GitHub. Une seule suite par PR, sans doublon au push ;
   une nouvelle révision annule les anciens contrôles devenus inutiles.
2. Relecture du diff ; pour l'interface, captures mobile/français/arabe.
3. Arrivée sur `main` : tests GitHub, puis installation des scripts validés.
4. Construction des images étiquetées avec le SHA Git.
5. Lancement des mêmes images dans `wilayadz-candidate`, sans volume réel,
   sans SMTP ni connexion Google, uniquement sur un port local temporaire.
6. Vérification API, compression, budget de transfert et `/release.json`.
7. Sauvegarde Google Drive vérifiée obligatoire avant remplacement des services.
8. Démarrage avec attente des contrôles de santé, puis vérification HTTP.
9. En cas d'échec, retour automatique aux images/configuration précédentes.

Le projet Compose de production reste **`deploy`** pour préserver le volume et
le réseau existants. Les versions déployées sont conservées dans
`/home/mednor/.local/state/wilayadz-releases`. `current.json` désigne la version
validée ; `previous.json` la précédente. Les images ne sont pas élaguées
automatiquement : ne pas supprimer celles référencées par ces fichiers.

L'initialisation de `current.json` doit reprendre la configuration réellement
déployée et étiqueter ses images existantes avant le premier lancement. Cela a
été effectué sur bigpc avant toute modification des services pour ce lot.

Les images précédentes suffisent pour ce lot sans migration de schéma. Une future
migration incompatible doit être traitée séparément : le retour des images ne
répare pas un schéma incompatible. La publication peut entraîner une brève
reconnexion ; ce mécanisme n'est pas un déploiement sans interruption.

## Retour manuel et restauration

Pour revenir aux services précédents, en gardant les données actuelles :

```bash
docker compose -p deploy -f /home/mednor/.local/state/wilayadz-releases/previous.json up -d --no-build --wait --wait-timeout 90
```

Après contrôle, mettre à jour `current.json` pour refléter ce retour manuel
et empêcher une publication automatique de réintroduire la version défectueuse.
Ne jamais utiliser `docker compose down -v` sur la production.

Pour éprouver une archive, la déchiffrer dans un répertoire temporaire privé,
sur disque local, puis utiliser `inspect_db()` de `deploy/ops/backup.py`.
La base active ne doit jamais être la destination de cette vérification.
Une restauration réelle nécessite d'arrêter l'API, conserver l'état actuel,
restaurer la copie validée avec propriétaire 10001, gérer les fichiers WAL/SHM
de l'ancienne base, puis relancer et vérifier. Elle n'est volontairement pas
automatique : elle supprimerait les écritures reçues depuis la sauvegarde.

## Surveillance et limites

Toutes les cinq minutes : santé Docker, API via nginx, dernier backup restaurable
(moins de 30 heures) et espace disque. Le rapport local est
`/var/lib/wilayadz-ops/health-status.json`. Les pannes rendent l'unité systemd
rouge et sont consignées dans le journal. Aucun message externe n'est envoyé.

```bash
journalctl -u wilayadz-backup -u wilayadz-monitor --since today
curl -fsS http://127.0.0.1:8099/api/health
curl -fsS http://127.0.0.1:8099/release.json
```

Ce contrôle local ne détecte pas une panne totale de bigpc depuis l'extérieur.
Un contrôle externe avec notifications reste une extension possible ; il n’est
pas prétendu actif.

L'API limite ses connexions simultanées à 16 et les calculs de mots de passe à 2.
En surcharge, elle répond 503 et peut reprendre après libération des connexions.
Les journaux nginx excluent les paramètres d'URL contenant potentiellement des
liens de réinitialisation. Aucun changement d'interface n'est nécessaire.

## Validation

`npm test` inclut `tests/test_production.py` : snapshot WAL, source manquante,
chiffrement/restauration, transfert Drive simulé et corruption au retour,
NAS absent pour l’ancien utilitaire optionnel, clé incorrecte, retour après échec,
limitation des calculs et saturation HTTP/récupération. GPG est testé sur Linux ;
son absence sur le Mac est signalée comme test sauté.
Les images sont en outre éprouvées dans Docker avant la bascule réelle.
`python3 tests/test_deploy_rollback.py <SHA>` simule une mauvaise version dans
un projet Docker jetable, vérifie le retour aux deux anciennes images et
confirme que les conteneurs de production n’ont pas changé.

Pour vérifier les images sans publication ni sauvegarde réelle :
`python3 deploy/release.py --check-only <SHA-complet>` sur bigpc.
nginx passe de 1.27.5 à 1.30.4, version stable vérifiée dans les
[publications officielles](https://nginx.org/en/download.html).
