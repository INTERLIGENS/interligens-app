# PACK S4 — classement des 1 102 `EvidenceItem` restées `UNCLASSIFIED`

**EXÉCUTÉ le 2026-08-28** sur `ep-square-band`, à la main, un fichier à la fois,
dans Neon SQL Editor. Ce document est désormais le **record de ce qui a été
passé**, pas un plan.

Fichiers passés : **01, 02, 04, 05, 06**. Le **03 n'a jamais été exécuté** et
est marqué `RETIRED` — voir plus bas.

## Ce que la base porte après S4

| `rowNature` | Lignes |
|---|---|
| `PRIMARY_OBSERVATION` | **1 052** (1 050 par S4 + 2 par S3) |
| `EDITORIAL_ASSERTION` | **11** |
| `UNCLASSIFIED` | **41** |
| `INFERENCE` · `THIRD_PARTY_DATA` · `ESTIMATE` | **0** |
| Total | **1 104** |

Les 41 `UNCLASSIFIED` se lisent en deux ensembles disjoints :

| Ensemble | n | Prédicat | Sens |
|---|---|---|---|
| Affirmations mixtes | **34** | `evidentiaryStatus IS NULL` | **dans** la chaîne, en attente d'un classement plus fin |
| Exclues | **7** | `evidentiaryStatus = 'EXCLUDED'` | **hors** chaîne probatoire |

`timestampMode` : 925 `retroactive` + 145 `approximated-from-repo-history` +
32 `retroactive` (PDF) + 2 `at-ingestion` = 1 104, **aucun NULL**.
Exclusions : 7, dont **0 sans motif** — l'invariant tient.

## La doctrine Data Nature, écrite

> Un `EvidenceItem` dont les affirmations sont de natures **non homogènes**
> reste `UNCLASSIFIED` jusqu'à classification au niveau **assertion**.
> `rowNature` ne force **jamais** une nature globale.

**`UNCLASSIFIED` ≠ `EXCLUDED`.** Une pièce non classée reste opposable et
compte dans la chaîne ; une pièce exclue n'y participe plus. Deux colonnes,
deux significations. Les confondre ferait disparaître 34 pièces valides.

Corollaire mesuré : `INFERENCE`, `THIRD_PARTY_DATA` et `ESTIMATE` valent **0**
sur `EvidenceItem`. Non par oubli — chaque artefact qui aurait pu les porter
s'est révélé mixte à la lecture. **Le corpus probatoire du produit ne contient
presque aucun document mono-nature en dehors des captures d'écran.**

## Les fichiers

| # | Fichier | Statut | Écrit | Lignes |
|---|---|---|---|---|
| 1 | `01_primary_observation.sql` | ✅ passé | `rowNature` | 1 050 |
| 2 | `02_editorial_assertion.sql` | ✅ passé | `rowNature` | 11 |
| 3 | `03_inference_RETIRED.sql` | ⛔ **RETIRÉ, jamais exécuté** | — | 0 |
| 4 | `04_temporal_confidence.sql` | ✅ passé | `timestampMode` | 1 070 |
| 5 | `05_exclusion_non_evidence.sql` | ✅ passé | 2 colonnes + 7 exclusions | 7 |
| 6 | `06_mixed_assertion_artifacts_GAP.sql` | ✅ passé (lecture seule) | rien | 0 |

### Le 03, retiré

Il proposait `sxyz500_hops.json` en `INFERENCE`. Le founder l'a sauté à
l'exécution, et l'arbitrage a ensuite **étendu OPTION C** à cette pièce : ses
6 entrées portent toutes un `_note` rédigé à la main, ce qui en fait un artefact
à affirmations mixtes au même titre que `BOTIFY_KOL_SCAN_REPORT.json`.

La réserve écrite dans le fichier **avant** exécution est ce qui a permis
l'arbitrage. Le fichier est conservé comme record d'une décision, son `UPDATE`
neutralisé en commentaire — un copier-coller distrait ne peut rien écrire.

L'ensemble `MIXED_ASSERTION_ARTIFACT` passe donc de 33 à **34 pièces**.

## Backlog ouvert

Les 34 pièces sont inscrites au chantier **`EvidenceItemAssertion`** —
voir `BACKLOG_EvidenceItemAssertion.md`. Aucune table créée : le coût réel
n'est pas la migration mais le dépouillement de 34 documents à la main.

## Recalage Prisma — fermé

`schema.prod.prisma` déclare les 16 colonnes Data Nature et l'enum
(PR #173, main `dca38bc`). Vérifié colonne par colonne contre
`information_schema` : **0 divergence**, enum identique valeur par valeur et
dans le même ordre. L'exemption guard ouverte pour ce recalage est refermée
byte-identique (PR #176, main `090cc52`).

## Les trois propriétés de S3, tenues

**Additif** — 2 `ADD COLUMN IF NOT EXISTS` nullables sans `DEFAULT`. Aucun
`ALTER`, aucun `DROP`, **aucun `DELETE`**.

**Rejouable** — chaque `UPDATE` gardé par un état. Relancer un fichier ne
produit rien la seconde fois.

**Jamais d'`UPDATE` global** — chaque prédicat explicite, chaque compte attendu
en commentaire, et tous vérifiés à l'exécution. Le lot `REPO_ARTIFACT` en est
l'illustration finale : 3 lignes, **3 destinations différentes** — un `UPDATE`
sur `sourceType` les aurait emportées d'un coup, dont deux que l'arbitrage a
mises de côté.

## Ce que ce pack N'A PAS fait

- **Aucun code produit modifié.** Les 7 pièces `EXCLUDED` ne sont filtrées
  nulle part : le filtrage en lecture reste à écrire. Poser la colonne ne fait
  pas respecter l'exclusion.
- **La doctrine n'est pas exécutable.** `src/lib/data-nature/` ignore la notion
  d'artefact à affirmations mixtes : rien n'empêche d'écrire une `rowNature` sur
  l'une des 34. La rendre opposable — invariant ou test — reste à faire.
- **Aucun `mimeType` corrigé** (4 `.webp` en `octet-stream`, 51 captures X
  étiquetées `OTHER`). Défauts d'ingestion réels, sans effet sur la nature.
- **Aucune recapture par permalien.** Les 753 captures de pages de recherche X
  restent `PRIMARY_OBSERVATION` ; la recapture est un backlog séparé.
  L'interdit qui l'accompagne — ne jamais citer une page de recherche
  personnalisée comme la preuve canonique d'un tweet — est une règle d'usage.
- **Aucun `DELETE`**, jamais.
