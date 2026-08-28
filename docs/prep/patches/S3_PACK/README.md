# PACK S3 — DDL additives, une migration PAR TABLE

**À APPLIQUER À LA MAIN. Rien n'a été exécuté.** Aucun DDL n'a touché la base :
tout ce qui précède ce pack est de la lecture seule sur `ep-square-band`.

**Neon SQL Editor uniquement. Jamais `prisma migrate`** — les deux schemas
portent le verrou A9 (`directUrl` pointe sur une variable qui n'existe nulle
part) et s'arrêtent sur `P1012` à `getConfig`, avant tout accès réseau.

## Ordre d'exécution

| # | Fichier | Table | Régime | Lignes | Écritures attendues |
|---|---|---|---|---|---|
| 0 | `00_enum_DataNature.sql` | — | — | — | `CREATE TYPE` |
| 1 | `01_KolTokenLink.sql` | `KolTokenLink` | FIELD | 292 | 691 |
| 2 | `02_TokenPriceTracker.sql` | `TokenPriceTracker` | FIELD | 340 | 1 354 |
| 3 | `03_token_casefiles.sql` | `token_casefiles` | FIELD | 2 ⚠️ | ≤ 6 |
| 4 | `04_EvidenceItem.sql` | `EvidenceItem` | ROW | 1 104 | 1 104 |
| 5 | `05_KolTokenInvolvement.sql` | `KolTokenInvolvement` | ROW | 15 | 15 |

Le fichier 0 est un prérequis dur : les cinq autres référencent le type.
Les cinq fichiers de table sont **indépendants entre eux** — un échec sur l'un
n'engage pas les autres. Exécuter un fichier, lire sa vérification, décider.

## Trois propriétés tenues par construction

**Additif.** Uniquement `ADD COLUMN`, jamais `ALTER`/`DROP` d'une colonne
existante. Les colonnes sont **nullables et sans `DEFAULT`** : PostgreSQL ne
réécrit pas la table, l'opération est instantanée même sur `EvidenceItem`.

**Rejouable.** Chaque `UPDATE` est gardé par `IS NULL`, chaque `ADD COLUMN` par
`IF NOT EXISTS`. Relancer un fichier deux fois ne produit rien la seconde fois.

**Jamais d'`UPDATE` global.** C'est la leçon de `MmClaimType.FACT` (§Q6) : une
même valeur source peut mapper vers deux natures selon la jointure. Chaque
écriture porte donc un prédicat explicite, et le nombre de lignes attendu est
écrit en commentaire à côté. **Un compte qui diverge = on s'arrête.**

## Réversibilité

Chaque fichier finit par son `ROLLBACK` en commentaire : `DROP COLUMN IF EXISTS`.
Le type ne se supprime qu'une fois toutes les colonnes retirées.

## Ce que ce pack NE fait PAS

- Aucune contrainte `NOT NULL`, aucun `CHECK`. La contrainte `methodRef` sur les
  `ESTIMATE` est S5, et elle est bloquée par un travail éditorial (voir plus bas).
- Aucun index. À poser seulement si une lecture par nature apparaît.
- Aucune fusion de synonymes — c'est S4.
- **Aucun classement humain.** Le pack pose les colonnes ; il ne prétend pas
  savoir ce qu'il ne sait pas.

## Questions ouvertes — à trancher AVANT d'exécuter

**1. `EvidenceSnapshot` : dans S3 ou dans S1 ?** Les deux documents se
contredisent. `BUILD2_DATA_NATURE_SPEC` §« S3 — périmètre exact » l'inclut
(1 159 lignes, et c'est exactement l'écart entre ses 2 911 lignes et les 1 752
de ce pack). Le registre `registry.ts` — plus tardif, mesuré, et couvert par le
test I5 — le classe `DECLARED / S1 / 0 écriture`, au motif qu'une capture
horodatée avec artefact récupérable est mono-nature. **Ce pack suit le
registre** et n'inclut pas `EvidenceSnapshot`. Si l'arbitrage tranche l'inverse,
un `06_EvidenceSnapshot.sql` est à ajouter — mais alors la table cesse d'être
`DECLARED`, ce qui change aussi le code.

**2. `token_casefiles` : 1 ligne ou 2 ?** Le registre annonce 1, la base en
porte **2** (mesuré 2026-08-28). Un écart de 100 % sur la table qui porte M3 —
les 482 M$ estimés à côté des 1,5 M$ revendiqués. Sur une table de cette taille
l'écart est sans gravité technique, mais il signifie que le registre n'a pas
été remesuré depuis, et le fichier 3 le signale en tête.

**3. Les 32 `MIGRATED_BACKFILL` d'`EvidenceItem`.** Non mappés délibérément :
cette valeur dit COMMENT la ligne est arrivée, pas CE QU'ELLE EST. Elles
restent `UNCLASSIFIED` avec les 1 070 `NULL`. La requête de vérification du
fichier 4 rend le croisement `(provenanceType, sourceType)` trié par volume :
c'est la file de travail du classement humain, du plus gros lot au plus petit.

**4. Les 39 estimations sans méthode** (`KolWallet` 29 + `KolCase` 10). Hors
périmètre de ce pack, mais c'est le **chemin critique** du plan : tant que
personne n'a écrit leur méthode ou ne les a déclassées, le `CHECK` de S5 ne peut
pas être posé. Ça ne se code pas.

## Après exécution

Le registre `src/lib/data-nature/registry.ts` devient vérifiable **contre la
base** et non plus seulement contre lui-même. Un test comparant les colonnes
réelles aux régimes déclarés fermerait la boucle — il n'existe pas encore.
