# MANIFEST — Corpus pédagogique INTERLIGENS

**Version** : 1.0
**Date** : 2026-05-24
**Owner** : David Douville
**Status** : V1.0 — production-ready, intégralement mergé sur `main` (tag `corpus-pedagogique-v1-2026-05-23`)

---

## 1. Vue d'ensemble

Le corpus INTERLIGENS regroupe 7 documents pédagogiques et opérationnels :

- **6 documents publics** sous licence **CC BY-NC 4.0** : whitepapers (Dark Patterns, Anatomy of a Rugpull), Investigation Checklist, Glossary OSINT-Crypto, Case Studies anonymisées, et un cours en 10 leçons.
- **1 document interne** sous **NDA strict** : le Manuel opérationnel investigateur, en deux variantes (core complet et light pour usage externe).

**Audiences cibles** :

- Enquêteurs sous NDA (cabinets juridiques, équipes investigation interne, bêta-testeurs externes).
- Cabinets juridiques spécialisés en fraude crypto.
- Journalistes d'investigation et chercheurs académiques.
- (V2 publique grand public retail prévue Q4 2026 — voir Roadmap).

Le corpus est conçu pour fonctionner comme un ensemble : les documents se référencent entre eux et partagent un vocabulaire commun (voir §4 Dépendances éditoriales).

---

## 2. Documents publics — CC BY-NC 4.0

| Document | Path | Langues | Statut | Word count |
|----------|------|---------|--------|------------|
| Whitepaper Dark Patterns | `content/whitepapers/dark-patterns-crypto.{md,fr.md}` | EN + FR | ✅ Mergé sur main (PR #10, PR #11) | EN 5844 / FR 7079 |
| Whitepaper Anatomy of a Rugpull | `content/whitepapers/anatomy-of-a-rugpull.{md,fr.md}` | EN + FR | ✅ Mergé sur main (PR #16) | EN 7398 / FR 8173 |
| Investigation Checklist | `content/playbooks/investigation-checklist.{md,fr.md}` | EN + FR | ✅ Mergé sur main (PR #12) | EN 5792 / FR 6764 |
| Glossary OSINT-Crypto-Investigation | `content/glossary/osint-crypto-glossary.{md,fr.md}` | EN + FR | ✅ Mergé sur main (PR #13) | EN 5717 / FR 6653 |
| Anonymized Case Studies (4 cas) | `content/case-studies/anonymized-cases.{md,fr.md}` | EN + FR | ✅ Mergé sur main (PR #14) | EN 7202 / FR 8445 |
| Crypto for Investigators Course (10 leçons) | `content/courses/crypto-for-investigators-10-lessons.{md,fr.md}` | EN + FR | ✅ Mergé sur main (PR #17) | EN 10997 / FR 12147 |

**Total publics, mergé sur main** : 6 documents / 6 (Dark Patterns, Anatomy, Investigation Checklist, Glossary, Case Studies, Course).

---

## 3. Documents internes — NDA-bound

| Document | Path | Langues | Statut | Word count |
|----------|------|---------|--------|------------|
| Operating Manual core (bêta-testeur) | `content/internal/operating-manual-investigator.fr.md` | FR | ✅ Mergé sur main (PR #15) | FR 7035 |
| Operating Manual light (enquêteur externe NDA) | `content/internal/operating-manual-investigator-light.fr.md` | FR | ⏳ Branche `feat/cc-offline-11-operating-manual-light` (créé 2026-05-24, pending review) | FR 5132 |

Les deux variantes du manuel partagent la même base structurelle mais s'adressent à des publics distincts :

- **Core** : bêta-testeur unique, accès complet, contient le cadre légal interne, la carte complète des surfaces, les limites détaillées et l'OPSEC core.
- **Light** : enquêteur externe sous NDA, version réduite, sans architecture interne, sans détails de scoring, sans cartographie exhaustive des surfaces. Contient un encadré d'avertissement en tête.

---

## 4. Dépendances éditoriales

Le corpus est conçu comme un graphe de références. Les flèches ci-dessous indiquent une dépendance forte (le document cible apporte le contexte ou le vocabulaire nécessaire à la lecture du document source).

- **Course → Glossary** : les leçons s'appuient sur les définitions du glossaire ; lecture conjointe recommandée.
- **Anatomy of a Rugpull → Case Studies** : le whitepaper structure la grammaire des indicateurs ; les cas studies illustrent cette grammaire sur 4 typologies concrètes.
- **Operating Manual (core et light) → Course** : le manuel suppose une maîtrise des fondamentaux couverts par le cours en 10 leçons.
- **Investigation Checklist → Anatomy** : la checklist opérationnelle s'articule à la taxonomie des dark patterns et à l'anatomie d'un rugpull pour lire les signaux.
- **Tous les documents → Glossary** : le glossaire est la racine vocabulaire du corpus.

Lecture conseillée pour un nouvel enquêteur : Glossary → Course → Anatomy + Dark Patterns → Case Studies → Investigation Checklist → Operating Manual.

---

## 5. Règles éditoriales

Le corpus respecte une discipline éditoriale unique pour préserver à la fois la précision pédagogique et l'exposition juridique contrôlée.

### 5.1 Disclaimer uniforme

Chaque document public porte en tête un disclaimer indiquant :

- Le caractère pédagogique (non une consultation juridique ou financière).
- La nature anonymisée et/ou composite des cas évoqués.
- La licence applicable.

### 5.2 Wording

- **Toujours** : « risque critique documenté », « indicateurs de risque observés », « éléments factuels suggérant ».
- **Jamais** : « scammer », « fraudster », « stolen by X », ni aucun équivalent qui présenterait un fait comme acquis avant qu'une autorité compétente ne l'ait établi.

### 5.3 Méthodologie technique

Le corpus ne contient pas :

- Aucun seuil chiffré de scoring.
- Aucune pondération.
- Aucun script reproductible permettant l'agression.
- Aucune mention de provider d'infrastructure spécifique.

Les définitions techniques (signaux, indicateurs, pivots) sont **minimalistes et non-architecturales** — la précision sans manuel d'opération.

### 5.4 Exception académique

Une exception est admise pour les citations verbatim de sources académiques ou journalistiques publiques, dans la limite de 30 mots par citation, avec source complète référencée.

---

## 6. Licence

### 6.1 Documents publics

- **Licence** : Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0).
- **Permis** : reproduction, partage, adaptation, à condition de mentionner la source et d'utiliser à des fins non commerciales.
- **Non permis sans accord écrit** : usage commercial (formation payante, intégration dans une offre commerciale, vente, monétisation publicitaire dépassant le seuil de minimis).

### 6.2 Documents internes

- **Licence** : Propriétaire — diffusion interdite.
- **Cadre** : NDA actif requis pour l'accès. Suppression de toute copie locale au terme du programme.
- **Pas de licence subsidiaire** : aucune extraction, paraphrase, ou citation hors NDA.

### 6.3 Clause commerciale

Pour tout usage commercial des documents publics (formation payante, intégration dans une offre commerciale, vente sous toute forme), une licence commerciale écrite est requise. Contact : `research@interligens.com`.

---

## 7. Roadmap

| Version | Date prévue | Périmètre |
|---------|-------------|-----------|
| V1.0 | Mai 2026 | Corpus complet (7 documents publics+internes + 1 light) en production. **État actuel : 6 documents publics mergés sur main + 1 interne core mergé (tag `corpus-pedagogique-v1-2026-05-23`). 1 interne light en branche pending review.** |
| V1.1 | Septembre 2026 (post-Indo) | Corrections issues du feedback bêta-testeur, ajout d'éventuels cas studies V1.1, finalisation merge Operating Manual light. |
| V2.0 | Q4 2026 | Version publique grand public retail (vulgarisation, format web interactif, complément du corpus existant — pas un remplacement). |
| V3.0 | 2027 | Extension thématique (DeFi avancée, NFT-specific frauds, social engineering crypto, juridictions extra-européennes). Revue juridique étendue. |

---

## 8. Contact

- **Éditeur** : INTERLIGENS Research
- **Contact éditorial** : `research@interligens.com`
- **Owner** : David Douville
- **Pour licence commerciale** : `research@interligens.com` (objet : « Licence commerciale corpus pédagogique »).

---

**Note de version 1.0 (2026-05-24)** : ce manifeste est créé pendant la fenêtre de préparation de l'absence prolongée du owner (1er juin → 27 juillet 2026). Il reflète l'état du corpus à cette date — corpus public V1 intégralement mergé sur `main` et taggué `corpus-pedagogique-v1-2026-05-23`. Une mise à jour est prévue au retour pour intégrer le feedback de la bêta et le merge final de la variante light du manuel.
