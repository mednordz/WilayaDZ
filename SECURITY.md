# Signature Android et protection des sauvegardes

## Incident de signature — 12 septembre 2026

La clé Android précédemment suivie par Git doit être considérée comme compromise : son fichier et son mot de passe ont été publiés. Elle n'authentifie ni les comptes web ni le serveur de synchronisation.

Mesures incluses dans cette correction : retrait du fichier de l'index Git, suppression du mot de passe dans la documentation actuelle, exclusion des fichiers de signature et garde de contrôle avant publication. Le fichier local est conservé afin de ne pas perdre les possibilités de migration des APK installés. **Ce retrait ne supprime pas les anciennes copies publiques et ne révoque pas la clé.**

Le développement actif est le site web ; l'APK v14 reste une ancienne version figée. Ne pas distribuer une nouvelle version signée avec la clé exposée. Avant une reprise Android :

1. Déterminer les versions Android et les canaux de distribution encore utilisés. Exporter la progression d'une installation de référence.
2. Créer une nouvelle clé dans un stockage privé sauvegardé, hors dépôt. Ne jamais insérer le mot de passe dans une commande enregistrée ou la documentation.
3. Préparer la rotation avec une lignée de signatures, puis vérifier une mise à jour de la v14 sans désinstallation et sans perte de données sur les versions Android ciblées. La compatibilité dépend de la version Android et du canal de distribution ; générer simplement une nouvelle clé ne suffit pas.
4. Si Play App Signing est utilisé, suivre la procédure du compte Play Console. Aucun accès Play Console n'a été vérifié dans cette intervention.
5. Nettoyer l'historique Git dans un miroir sauvegardé : retirer `android/keystore/wilayas-v2.jks` de toutes les références et remplacer le secret dans les anciennes révisions de `PROJECT_NOTES.md`. Examiner les branches/tags, publier l'historique nettoyé après accord explicite sur cette réécriture et coordonner les clones existants. Des forks ou anciennes copies peuvent rester accessibles : la rotation est indispensable.

Sources : [signature Android](https://developer.android.com/studio/publish/app-signing), [rotation et vérification avec apksigner](https://developer.android.com/tools/apksigner).

## Format des sauvegardes

Le format externe conserve `v:1` et ajoute `sv:2`, `ra` (génération de remise à zéro) et la date de dernière réponse dans chaque entrée `[niveau, échéance en jours, date en millisecondes]`. Les anciens codes restent importables, mais une ancienne génération ne doit pas ressusciter la progression effacée.

Le serveur refuse qu'un ancien client retire ces métadonnées d'un compte déjà migré. Il faut alors actualiser l'application. Les écritures sont conditionnées atomiquement par la version de la sauvegarde ; un conflit renvoie la version courante pour une nouvelle fusion.

Les dates de réponse utilisent l'horloge des appareils. La règle de fusion donne priorité à la date la plus récente ; à date égale, le niveau le plus prudent gagne. La synchronisation n'est pas un journal historique de toutes les réponses. Les XP conservent le total maximal des appareils, conformément à la règle de fusion existante.
