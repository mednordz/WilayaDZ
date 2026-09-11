# Audit — WilayaDZ

Portée : sécurité, accessibilité (WCAG 2.1 AA), régression fonctionnelle, conformité de licence. Méthode : lecture de code ciblée + tests automatisés (Playwright, axe-core) sur les deux langues (fr/ar) et les écrans principaux (parcours, feuille d'info, entraînement, infos, leçon).

Tous les problèmes trouvés ci-dessous ont été corrigés, revérifiés, puis redéployés (Artifact + APK).

## 1. Sécurité — Critique (corrigé)

**Injection HTML (XSS) via le nom de profil**, dans l'écran « Qui apprend ? » (choix de profil).

Le nom de chaque profil était inséré tel quel dans l'attribut `aria-label` du bouton de profil, lui-même injecté via `innerHTML`. Un nom de profil contenant un guillemet permettait de sortir de l'attribut et d'injecter du HTML/JS arbitraire — vérifié avec un scénario reproductible : deux profils sur un même appareil (le cas normal d'une famille qui partage un téléphone), aucun profil actif au démarrage → l'écran de choix s'affiche → le nom piégé s'exécute.

Impact réel : limité (application locale, pas de serveur), mais concret — le code de transfert entre appareils fait circuler des noms de profil, donc un nom piégé pourrait se propager d'un appareil à l'autre.

**Correctif :** la fonction d'échappement centrale (`esc()`) échappait `&`, `<`, `>` mais pas les guillemets — insuffisant pour du texte inséré dans un attribut. Elle échappe maintenant aussi `"` et `'`. Vérifié par test automatisé : le nom piégé s'affiche désormais comme texte inerte, plus d'exécution.

## 2. Accessibilité (WCAG 2.1 AA) — 3 violations, corrigées

Scan automatisé (axe-core) sur 10 combinaisons écran × langue : **3 violations « serious »**, aucune restante après correctif.

| Problème | Écran | Critère | Correctif |
|---|---|---|---|
| La carte SVG (`role="img"`) contenait 69 points cliquables au clavier — contradictoire : un lecteur d'écran traite un `role="img"` comme une image plate, sans rien à l'intérieur | Infos | 4.1.2 | `role="img"` → `role="group"` |
| Le tableau des 69 wilayas (zone défilante) n'était pas atteignable au clavier | Infos | 2.1.1 | `tabindex="0"` + `role="region"` sur le conteneur |
| Le libellé arabe de l'onglet actif tombait à 4.24:1 (minimum 4.5:1) à cause d'une légère transparence | Entraînement (ar) | 1.4.3 | Suppression de l'opacité sur ce libellé |

Point mineur relevé, non corrigé (hors AA — c'est un critère AAA) : le bouton profil (36×36px) est sous la cible tactile de confort de 44×44px. Il reste largement au-dessus du minimum AA de facto (24×24px). Je le laisse tel quel sauf si tu veux que j'agrandisse la zone.

## 3. Régression fonctionnelle — rien de cassé

Après les deux correctifs ci-dessus, la suite de tests existante (rendu fr/ar/bilingue, changement de langue à chaud, RTL/bidi, multi-profils) repasse sans erreur console ni régression visuelle.

## 4. Autres points vérifiés (sans problème trouvé)

- **Robustesse du code de transfert** : `parseCode()` valide le format, le checksum et le JSON avant tout traitement — un code corrompu ou mal collé échoue proprement, ne fait pas planter l'app.
- **Licence de la police intégrée** (Bouazzi Maghribi) : MIT, confirmée à la fois dans le README et dans les métadonnées du fichier de police lui-même.
- **Confidentialité** : aucune donnée ne quitte l'appareil (pas de réseau applicatif, tout est en `localStorage`). Rappel du point déjà connu : le code PIN est un verrou local, pas un vrai chiffrement (`crypto.subtle` indisponible en contexte APK hors-ligne) — c'était déjà documenté et communiqué, pas une découverte de cet audit.

## Statut

Correctifs appliqués, revérifiés, et déployés :
- Artifact republié à la même adresse.
- APK reconstruit et signé avec la **même clé** que le dernier envoi — pas de désinstallation nécessaire cette fois.
