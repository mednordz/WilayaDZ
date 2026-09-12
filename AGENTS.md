# WilayaDZ — règles de travail

- Préserver les écrans, le bilingue français/arabe, les profils, la progression
  et les ressources existantes. Faire des changements ciblés ; une refonte
  visuelle doit correspondre à une demande explicite de l'utilisateur.
- Modifier les sources dans `app/`, jamais `app/wilaya-v6.html` ni `_check.js`.
- Isoler le travail sur une branche `codex/…`. Ne pas intégrer les fichiers
  non suivis ou modifications préexistantes d'un autre travail sans nécessité.
- Utiliser `npm test` pour la validation complète. Les essais utilisent des
  comptes fictifs et une base séparée ; ne pas créer ni modifier des comptes
  réels pour tester. Pour un changement visible, vérifier mobile, FR/AR et thèmes.
- Consulter `PRODUCTION.md` avant toute opération serveur. Le projet Compose
  de production est `deploy` ; son volume est `deploy_wilaya-data`.
- Ne jamais supprimer ce volume, vider les comptes, restaurer une ancienne base
  ou modifier le tunnel/Postfix partagés au titre d'une simple publication.
- Les secrets et copies de récupération restent hors Git et hors journaux.
  `.local-ops/` est privé et ignoré. GitHub ne sauvegarde pas les comptes.
- Une publication sur `main` est automatique après contrôles. Distinguer
  clairement « préparé », « testé », « publié » et « vérifié en production ».
- Aucun MCP supplémentaire n'est requis pour le développement ordinaire.
