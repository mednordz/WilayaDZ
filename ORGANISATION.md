# Apprendre et Explorer

## Répartition

- **Apprendre** : prochaine action recommandée, progression, chemin à huit unités, atelier et guide des codes.
- **Mon atelier**, dans Apprendre : révisions dues, rafale, confusions, entraînement libre et état de la mémoire. Le panneau se déplie sur place. Les anciens raccourcis `switchTab('practice')` ouvrent ce même panneau ; les contrôles et leur état ne sont pas dupliqués.
- **Les clés pour apprendre**, dans Apprendre : méthode alphabétique, repères et indices. Le lien d’aide des réglages ouvre ce guide.
- **Explorer** : carte interactive, registre complet des wilayas et sources géographiques.
- **Réglages** : compte, connexion, confort, sauvegardes, synchronisation, version et assistance.

La barre principale compte deux destinations. L’atelier et le guide sont des panneaux natifs `details/summary`, accessibles au clavier, sans nouvelle page ni état de progression supplémentaire.

## Identité

Réutilisation de la faïence algéroise existante : bordures de panneaux, bandeaux des cartes, fonds légers et cadre de la carte. Le fichier `app/organisation.css` complète les matériaux d’Algérie blanche. Aucun changement de mascotte ou de pédagogie.

## Vérification

`npm test` : suite complète réussie. Contrôle supplémentaire `tests/test_organisation.js` : emplacement unique des contenus, deux destinations, raccourcis de révision, panneaux au clavier, accessibilité, FR/AR/bilingue et progression conservée. Ce contrôle est ajouté à la suite obligatoire.

Captures réelles dans `docs/organisation/`. Branche `codex/apprendre-explorer`. Aucune publication ni opération de production.
