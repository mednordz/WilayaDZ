# WilayaDZ — Algérie blanche

## Direction intégrée

Enduit ivoire, encre méditerranéenne, céramique turquoise et détails de laiton. Le haut de page et les réglages approuvés servent de référence. Les mascottes et la logique d’apprentissage ne sont pas modifiées.

- Parcours : patio illustré, grands médaillons accessibles, liaison pointillée, niveaux réels conservés, cartouches lisibles et chemin inversé en arabe.
- Entraînement et informations : introductions en enduit, cartes de faïence, icônes en niches, tableaux et carte géographique sur les mêmes surfaces.
- Leçons : cartes de découverte, réponses, saisie et résultats harmonisés ; frise de céramique dans la barre supérieure.
- Profil, connexion et transferts : mêmes encres, formulaires et cadres ; les états fonctionnels et les données sont conservés.
- Navigation : frise commune et arches existantes, ancrage fixe conservé.
- Nuit : surfaces bleu-vert et encre claire. Le patio d’accueil et les réglages conservent leur composition claire approuvée.

## Sources

`app/p1_css.css` porte les palettes jour/nuit. `app/algerie-blanche.css` porte les matériaux partagés et les adaptations du parcours. `app/build.py` incorpore les illustrations hors ligne. Les réglages de police, taille et mouvement restent disponibles.

Le nouveau décor de 47 Ko est décrit avec son prompt dans `app/assets/algerie-blanche/README.md`. Il est réutilisé, sans produire une image différente pour chaque contrôle. Les libellés, interactions et indicateurs restent du HTML ; la décoration ne reçoit aucun événement.

## Vérification

Validation effectuée le 12 septembre 2026 : `npm test` terminé avec succès, incluant interfaces mobiles, français/arabe/bilingue, thèmes, accessibilité, navigation, sauvegardes et pédagogie sur données fictives. Inspection supplémentaire des captures à 390 px : parcours, entraînement, informations, profil, fiche d’unité et leçon dans les trois langues.

Cette version est préparée sur `codex/algerie-blanche`, sans publication ni modification du serveur de production.
