# WilayaDZ — évolution de la pédagogie

Date : 12 septembre 2026. Audit de la branche `codex/parcours-niveaux`, base `12f5f0b`.
Statut : diagnostic et cible pédagogique. Premier lot implémenté sur `codex/pedagogie-adaptive`, non publié. Le tableau d'audit ci-dessous décrit la base avant corrections.

## Objectif et limites

Retrouver durablement le code d'une wilaya et identifier la wilaya à partir de son code, dans la langue choisie. La localisation sur la carte constitue une compétence supplémentaire : elle ne doit pas être considérée comme acquise grâce à un score code/nom.

La réussite d'une séance, la vitesse et les XP ne prouvent pas une rétention durable. L'efficacité devra être mesurée sur des rappels différés, avec de vrais apprenants. Les seuils proposés ci-dessous sont des hypothèses de produit à tester, pas des constantes scientifiques.

## Audit du moteur actuel

Sources principales : `app/p4a_core.js`, `app/p4b_exercises.js`, `app/p4c_session.js`, `app/p4d_path.js`, `app/p4g_account.js`.

Points à conserver : rappel actif, premières questions guidées, répétition espacée, correction affichée, distracteurs issus des confusions, sauvegarde après chaque réponse, progression par unités et accessibilité FR/AR/bilingue.

| Priorité | Constat vérifié | Conséquence |
| --- | --- | --- |
| P0 | `recordAnswer` permet cinq promotions successives sans délai entre réponses. | Une réussite immédiate peut reporter le rappel de 35 jours sans preuve de rétention différée. |
| P0 | Seules les réponses sous 5 s en QCM, ou sous le seuil propre à l'exercice, font monter la boîte. Une réussite lente réinitialise néanmoins l'échéance. | La lecture et la manipulation pénalisent la progression ; une réponse lente en boîte 5 repousse tout de même la révision de 35 jours. |
| P0 | QCM, saisie, bloc alphabétique, voisinage, chaîne et rafale passent par le même score de wilaya. Une chaîne est attribuée à sa première wilaya. | Des compétences différentes sont comptabilisées comme une même preuve. La rafale peut modifier l'échéance de mémorisation. |
| P1 | La liste d'exercices est construite avant les réponses. Le tirage évite seulement la répétition immédiatement précédente. | La couverture de l'unité n'est pas garantie ; une erreur ne déclenche pas une reprise adaptée dans la séance. |
| P1 | La saisie teste le nom vers le code ; les deux directions partagent pourtant une seule boîte. | L'application ne sait pas quelle direction l'élève sait réellement restituer. |
| P1 | Un niveau est gagné à la fin d'une leçon réussie, sans critère de couverture ni rappel différé. | Cinq niveaux gagnés ne signifient pas que toutes les wilayas sont durablement connues. |
| P1 | Les erreurs de certains exercices utilisent des identifiants négatifs, enregistrables dans `confusions`. | Des réponses de type bloc/écart polluent un registre prévu pour les paires de wilayas. |
| P1 | Cinq erreurs peuvent interrompre une leçon ou une révision avec les cœurs. | La séance peut s'arrêter précisément quand un accompagnement serait utile. |
| P2 | Les confusions sont cumulées sans signal de résolution ; les révisions prennent les 15 plus anciennes échéances. | Les anciennes difficultés peuvent rester surreprésentées ; l'ancienneté ne décrit pas à elle seule le besoin pédagogique. |

Reproduction isolée avec les fonctions réelles `rec` et `recordAnswer`, évaluées dans Node VM avec une horloge fixe et un état fictif :

- cinq bonnes réponses à 1 s au même instant : boîte 5, échéance à +35 jours ;
- cinq bonnes réponses à 6 s, seuil QCM 5 s : boîte 0 ;
- une bonne réponse à 10 s en boîte 5 : nouvelle échéance à +35 jours ;
- une mauvaise réponse portant l'identifiant `-1` : entrée `confusions[3][-1]` créée.

Ces vérifications démontrent des comportements du code, pas un taux d'oubli observé chez les utilisateurs.

## Cycle d'apprentissage proposé

1. **Découvrir.** Présenter un petit groupe de wilayas avec nom, code et un repère pertinent. Première hypothèse : 2 à 4 nouveautés par séquence. Les anecdotes et repères géographiques doivent être vérifiés ; les images décoratives ne doivent pas donner la réponse pendant une évaluation.
2. **Retrouver avec aide.** Utiliser des QCM simples pour établir l'association. Varier la position des réponses et éviter les indices visuels involontaires.
3. **Retrouver sans aide.** Passer au code saisi et au rappel inverse. Proposer « Voir un indice » et « Je ne sais pas » : ils déclenchent une aide, pas une fausse réussite autonome. La saisie de noms demandera une gestion documentée des variantes FR/AR ; une faute orthographique ne doit pas être confondue avec une erreur de wilaya.
4. **Corriger puis retenter.** Montrer la bonne association et, si utile, la comparer à la wilaya confondue. Réintroduire la notion après plusieurs autres questions ; commencer par 2 à 4 questions intercalées, à évaluer. Une réussite juste après correction est une reprise, pas une preuve indépendante de rétention.
5. **Confirmer plus tard.** Revenir lors d'une séance différée, sans avoir affiché la réponse juste avant. Une grille initiale J+1, puis environ J+3, J+7, J+16, J+35 peut servir de point de départ ; chaque étape se décide à partir de la dernière preuve admissible et les intervalles restent à calibrer.
6. **Entretenir et transférer.** Mélanger anciennes associations, confusions encore actives et quelques nouveautés. Ajouter ensuite une piste carte séparée, avec son propre suivi de localisation.

La séance reste courte et interruptible. Après plusieurs échecs sur une notion, proposer de revoir sa fiche puis de la reprendre plus tard, sans boucle infinie. Les cœurs et le chronomètre restent possibles dans les défis facultatifs ; ils ne bloquent pas l'apprentissage normal.

## Mesurer ce qui a réellement été appris

Séparer trois dimensions :

- **Parcours accompli** : unités et niveaux déjà gagnés, conservés définitivement comme historique.
- **Compétences démontrées** : reconnaissance, rappel nom→code, rappel code→nom et, plus tard, localisation.
- **Entretien de la mémoire** : rappel à prévoir, rappel effectué, difficulté récente. Une échéance dépassée signifie « à revoir », pas « oublié ».

Conserver les cinq repères visuels du médaillon, mais donner un sens explicite aux futures étapes : découverte, reconnaissance, rappel nom→code, rappel code→nom, confirmation différée. Le statut d'entretien reste distinct. Ne pas recalculer rétroactivement les anciennes couronnes comme si ces évaluations avaient eu lieu : afficher leur origine historique et proposer un bilan de confirmation sans perte d'acquis.

La validation d'une étape doit couvrir toutes les associations concernées ; un tirage aléatoire de dix questions n'y suffit pas. Étaler cette couverture sur plusieurs séances, montrer ce qui reste et ne pas exiger un test interminable pour une unité entière. Débloquer la suite après une première acquisition suffisante, sans obliger à attendre plusieurs jours ; la confirmation différée se poursuit en parallèle.

## Règles du futur ordonnanceur

- Une réponse correcte lente est une réponse correcte. La vitesse sert éventuellement aux défis ou au diagnostic, jamais de verrou unique de maîtrise.
- Le rappel autonome différé, la reconnaissance et la reprise après aide sont des observations distinctes. Les intervalles longs s'appuient sur les premières, pas sur une série de clics dans la même séance.
- Une réponse avant échéance peut servir d'entraînement sans repousser systématiquement la révision ni augmenter le niveau de rétention.
- Une erreur déclenche une correction et une reprise rapprochée de la compétence concernée ; elle n'efface ni les niveaux gagnés ni toutes les autres compétences de cette wilaya.
- Le mode rafale ne reporte pas les échéances et ne certifie pas la maîtrise. Ses erreurs peuvent suggérer une vérification calme, sans sanction automatique.
- Les exercices de structure (blocs, chaîne, écarts) disposent d'un objectif propre. Ne pas attribuer arbitrairement leur résultat à une seule association code/nom.
- Le prochain exercice est choisi après chaque réponse, avec priorité aux reprises arrivées à maturité, aux rappels dus et à la couverture manquante. Garder une part de nouveautés selon la charge et le choix de l'élève ; aucun ratio n'est présenté comme universel.
- Limiter la durée et le nombre de reprises. En cas de retard important, proposer un rattrapage fractionné sans avalanche de notifications ni perte de série imposée par le retard.
- Une confusion n'est enregistrée que pour deux wilayas valides ; sa priorité diminue après des distinctions réussies dans des séances différées.

## Données et compatibilité

Le modèle actuel `box/due/seen/ok/best` ne permet pas de reconstruire les directions, les aides ou l'espacement historique. L'import actuel compacte aussi certaines données ; une extension du seul moteur serait insuffisante.

Prévoir un schéma versionné et additif : observations avec identifiant unique, wilaya, compétence/direction, format, langue d'affichage, moment, séance, résultat initial, aide/correction reçue et version de l'ordonnanceur. La durée active est optionnelle ; suspendre son décompte lorsque la page n'est pas visible. Ne pas enregistrer inutilement le texte libre saisi.

Les observations doivent fusionner sans doublons entre appareils ; les états calculés doivent être reproductibles. Définir la rétention et la compaction du journal avant une collecte illimitée. Les profils anciens démarrent avec une preuve historique de précision inconnue, pas avec des rappels différés inventés.

Mettre à jour ensemble sauvegarde locale, synchronisation serveur, export/import, validation et tests de compatibilité. Prévoir le comportement des anciens clients et le retour à la version précédente avant activation. Aucun changement de base ni de compte réel n'a été effectué pour cet audit.

## Mise en œuvre progressive

1. **Fiabiliser la mesure** : identifier les compétences et les aides, empêcher les promotions répétées sans espacement, retirer le verrou de vitesse, isoler les jeux, filtrer les fausses confusions. Verrouiller le contrat de données et les règles de migration avec les tests avant activation.
2. **Adapter les séances** : sélection après réponse, couverture explicite, correction suivie d'une reprise, limites de durée, apprentissage sans blocage par les cœurs.
3. **Aligner le parcours visuel** : fiche du médaillon expliquant les compétences démontrées et le prochain objectif. Préserver l'habillage approuvé et les niveaux historiques.
4. **Valider puis étendre** : comparer la rétention différée et la charge d'apprentissage, ajuster les intervalles, puis intégrer la carte comme compétence propre.

Tests attendus : répétitions au même instant, franchissement d'échéances, réponses lentes, erreurs après réussite, aides, couverture des deux directions, fin de séance anticipée, rafale isolée, import ancien, synchronisation simultanée/idempotente et hors ligne. Validation complète par `npm test`, plus contrôles mobile, FR/AR/bilingue et thèmes pour les changements visibles.

Indicateurs d'efficacité : proportion d'associations correctement rappelées sans aide à J+1/J+7/J+30, dans chaque direction ; nombre d'associations testées et absences aux bilans ; minutes et tentatives nécessaires par association retenue ; abandons ; charge de révision. Ne pas utiliser les seuls XP, séries ou clics comme preuve. Les bilans constituent eux-mêmes une pratique : appliquer le même protocole aux méthodes comparées et comparer à temps d'étude comparable. Un pilote ne justifie pas une promesse de perfection.

## Fondements scientifiques

- Roediger & Karpicke, 2006 : le rappel par test peut améliorer la rétention différée par rapport à la relecture dans les conditions étudiées. [Article des auteurs](https://psychnet.wustl.edu/memory/wp-content/uploads/2018/04/Roediger-Karpicke-2006_PsychSci.pdf).
- Cepeda et al., 2006 : synthèse quantitative de la pratique distribuée ; l'espacement compte et dépend notamment de l'horizon de rétention. [Publication](https://pubmed.ncbi.nlm.nih.gov/16719566/).
- Rawson & Dunlosky, 2011 : étude du critère initial et des réapprentissages pour une rétention durable et efficace. [Publication](https://pubmed.ncbi.nlm.nih.gov/21707204/).
- Butler & Roediger, 2008 : le feedback peut renforcer les bénéfices des QCM et réduire les effets des distracteurs erronés. [Publication](https://pubmed.ncbi.nlm.nih.gov/18491500/).

Ces résultats motivent le rappel, la correction et les séances espacées. Ils ne valident pas directement les cinq étapes visuelles, le nombre de nouveautés ou les intervalles précis proposés pour WilayaDZ.

## Premier lot réalisé

- Promotions conditionnées par l'échéance existante ; réponses correctes lentes acceptées. Les QCM sont plafonnés à la boîte 2 et le rappel saisi devient accessible dès cette boîte. Les anciens scores ne sont pas réinitialisés.
- Erreur : reprise à dix minutes, recul d'une boîte ; une reprise guidée dans la séance ne repousse pas l'échéance.
- Rafale et exercices de structure isolés du score de mémoire ; classement conservé en fin de leçon. Nettoyage des identifiants de confusion invalides lors de l'export, sans modifier le profil source.
- Couverture de chaque wilaya de l'unité ; format choisi lors de l'affichage. Une reprise au maximum par wilaya et six au maximum par séance, avec deux questions intercalées lorsque possible. Les révisions ciblées gardent leur unité pour les reprises.
- Apprentissage sans blocage par les cœurs ; aucune nouvelle couronne si une association reste non résolue dans la séance. Les couronnes continuent à désigner des leçons accomplies, pas les cinq compétences de la cible future.
- Bouton « Je ne sais pas » donnant la correction ; saisie des chiffres arabes et persans prise en charge, chaînes partiellement numériques rejetées.
- Contrat de sauvegarde inchangé : aucune migration serveur nécessaire pour ce lot. Les anciens clients appliquent encore leurs anciennes règles ; déployer les nouvelles sources avant d'évaluer les effets du moteur.

La mesure persistante par direction, le journal fusionnable des observations, la découverte par petits groupes et la nouvelle signification des cinq étapes restent à implémenter ensemble. La protection par échéance de ce lot ne prétend pas reconstruire les preuves historiques manquantes. La localisation sur carte ne change pas.

Validation dédiée : `tests/test_pedagogie.js` teste les fonctions réelles avec une horloge fictive et les séances complètes dans un navigateur mobile FR/AR/bilingue, clair/sombre. `tests/test_sync.js` couvre aussi les anciennes confusions invalides. Ces tests vérifient le logiciel, pas l'efficacité mesurée chez les apprenants.
