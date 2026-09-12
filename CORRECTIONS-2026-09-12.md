# Fiabilisation du 12 septembre 2026

L'interface est conservée. Cette livraison corrige les défauts fonctionnels de l'audit et renforce la validation avant publication.

- Synchronisation : réconciliation de l'état affiché et enregistré, y compris en arrière-plan ; conservation des réponses saisies pendant une requête ; nouvelle tentative sur conflit ; pas de redémarrage de la leçon lors d'une fusion ordinaire.
- Mémoire : la réponse datée la plus récente prime sur un ancien meilleur niveau. Une erreur peut donc réellement avancer la prochaine révision.
- Remise à zéro : génération synchronisée entre appareils, rejet des anciennes générations ; une remise à zéro distante ferme la leçon devenue obsolète.
- Serveur : contrôle atomique de la version lors des écritures concurrentes, validation du contenu et protection contre les clients qui retireraient les nouvelles métadonnées.
- Transferts : schéma strict partagé entre client et serveur ; rejet des clés dangereuses et valeurs invalides ; QR sans photo ; export fichier complet avec photo et solution explicite lorsque le QR reste trop volumineux.
- Stockage local : une erreur de sauvegarde n'est plus passée sous silence.
- Contenu : nom actuel de Chlef harmonisé, ancien nom conservé dans l'explication historique ; fonctionnement du compte et références des nouvelles wilayas actualisés.
- Performance : page HTML précompressée à environ 1,29 Mo contre 3,06 Mo, servie par nginx aux navigateurs compatibles, soit environ 58 % de données en moins. Le mode hors connexion conserve la page et les visuels embarqués. La revalidation du cache reste active jusqu'à son achèvement.
- Publication : contrôles navigateur obligatoires sur un environnement isolé, versions des outils verrouillées ; suppression du test qui arrêtait l'API de production ; publications successives sérialisées.
- Signature Android : clé retirée des fichiers suivis, secret supprimé de la documentation actuelle, exclusion et contrôle contre une nouvelle publication accidentelle. **La rotation de la clé exposée et la purge de l'historique ne sont pas réalisées.** Voir [SECURITY.md](SECURITY.md).

## Validation

`npm test` exécute le serveur et les navigateurs sur des données fictives, puis nettoie le serveur local. Validation locale passée :

- 46 contrôles de synchronisation/validation JavaScript, dont conflits, réponses pendant les requêtes, données invalides, suppression d'avatar et échec de stockage ; corpus également validé en Python.
- 136 vérifications HTTP du service de comptes.
- 62 vérifications navigateur de comptes et récupération ; 22 écrans de comptes sans violation axe.
- Carte : 69 tracés, clavier/zoom et 6 configurations ; pages : 18 écrans et 4 mascottes ; parcours : 6 configurations ; aucun défaut signalé par ces contrôles.
- Échelle de maîtrise, rendu Rive, 24 vérifications de musique.
- Deux appareils après remise à zéro, QR d'un profil avec photo, téléchargement de la sauvegarde complète et carte ouverte sans réseau.

Les tests restent une couverture ciblée : pas de téléphone physique, d'APK mis à jour ni de Safari iOS testé. Le format reprend la règle existante du maximum des XP entre appareils ; ce n'est pas un journal additionnant toutes les sessions concurrentes. Les dates de réponse utilisent les horloges des appareils.

## Compatibilité

Les anciens codes sont lisibles. Après migration d'un compte vers les sauvegardes datées, un ancien client doit être actualisé pour recommencer à synchroniser ; cela empêche qu'il retire les informations nécessaires aux remises à zéro et à la datation des réponses. Ne pas revenir à un ancien serveur qui supprimerait cette protection sans examiner les sauvegardes.
