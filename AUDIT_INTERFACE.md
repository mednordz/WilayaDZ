# Audit visuel et logique — 12 septembre 2026

Branche : `codex/audit-css`. Corrections préparées sur la version publiée `920f8c8`, sans opération sur les comptes réels ni publication.

## Défauts corrigés

1. **Carte de prochaine étape** : des noms longs empiétaient sur « Commencer » à 320 px avec texte agrandi. Le bouton passe sous le texte jusqu’à 420 px.
2. **Bilingue sur écran étroit** : titres, consignes et fiches utilisaient deux colonnes trop étroites. Les langues sont disposées sur des lignes complètes dans les composants concernés ; les noms bilingues des wilayas restent disponibles.
3. **Fiche de maîtrise** : les libellés et compteurs pouvaient entrer en collision. Le compteur ne rétrécit plus et les libellés s’adaptent à la place disponible.
4. **Tableau de mémoire et quiz** : les barres devenaient minuscules, les statistiques se fragmentaient et les choix de mode occupaient une largeur irrégulière. Une grille dédiée organise ces éléments sur mobile.
5. **Mémoire du pilote ignorée** : le tableau pouvait classer « jamais vues » des wilayas étudiées dans l’atelier. Les catégories combinent désormais les preuves du pilote et l’ancien entraînement, sans transformer une découverte en maîtrise. Une erreur de rappel indique un besoin de consolidation ; les étapes acquises restent conservées.
6. **Indicateurs périmés** : après une réponse libre, le chemin, le tableau de mémoire et le registre n’étaient pas rafraîchis. Ils sont actualisés avec l’état enregistré.
7. **Question sautée deux fois** : « Passer » ne supprimait pas l’ancienne avance automatique. Toute nouvelle question annule maintenant la temporisation précédente.
8. **Saisie incohérente** : `parseInt` acceptait une entrée partielle comme « 1a » et ne traitait pas les chiffres arabes comme les leçons. La saisie libre valide désormais la totalité de l’entrée et accepte les chiffres arabes et persans. Une saisie mal formée ne modifie pas le score.
9. **Navigation clavier** : la barre d’onglets n’appliquait pas la navigation directionnelle et le focus unique. Flèches, Début et Fin fonctionnent désormais, avec prise en compte du RTL et accès conservé depuis les réglages.
10. **Modalité des leçons** : le contenu derrière la leçon restait interactif et pouvait défiler. Il devient inerte pendant la séance, puis est restauré. Le redémarrage d’une séance conserve correctement cet état et son origine de focus. Les contrôles désactivés sont exclus du cycle de tabulation.
11. **Message de sortie trompeur** : la confirmation annonçait une perte de progression malgré la sauvegarde des réponses. Elle distingue maintenant réponses conservées et séance non terminée.

12. **Cartes indisponibles illisibles** : leur opacité de 50 % atténuait aussi les explications. Les textes conservent maintenant leur contraste ; une bordure pointillée et l’absence de relief indiquent leur indisponibilité.

13. **Validation masquée par la navigation** : avec une hauteur réduite à 360 px, Chromium pouvait placer le champ et « Valider » sous la barre fixe. Le document réserve maintenant la hauteur nécessaire lors du défilement vers un contrôle. Un test vérifie la géométrie réelle sur les deux moteurs.

## Couverture

Inspection de 66 états capturés : 11 écrans (accueil, atelier, quiz, guide, carte, registre, profil, réglages, affichage, fiche d’unité, leçon) × 3 configurations × 2 moteurs. Configurations : bilingue 320 px / texte 125 % / thème nuit, arabe 390 px / jour, français 768 px / jour. Animations actives. Débordements de page et débordements internes contrôlés ; les libellés réservés aux lecteurs d’écran sont exclus des faux positifs de largeur.

`tests/test_layout_logic.js` ajoute des régressions obligatoires dans Chromium et WebKit : collision texte/bouton, libellés, largeur des barres, catégories de mémoire, raccourcis clavier, temporisation de question et saisie. Les tests de pédagogie vérifient également la réouverture de séance avant fermeture.

Installer les moteurs avec `npx playwright install chromium webkit`, puis lancer `npm test`. Le workflow CI installe désormais les deux moteurs. Le budget gzip de 1,6 Mo reste imposé par le build.

## Limites

WebKit automatisé ne remplace pas un essai sur un iPhone physique avec son clavier et ses barres de navigateur. Les comptes et Google sont simulés dans les tests. Cette couverture décrit les cas examinés ; elle ne démontre pas l’absence absolue de défauts dans toutes les situations.

Captures de contrôle WebKit à 320 px, texte 125 %, dans `docs/audit-interface/`.

Validation locale : `npm test` complet réussi ; dernière correction de lisibilité contrôlée ensuite sur les 18 écrans de `test_design_pages.js`.
