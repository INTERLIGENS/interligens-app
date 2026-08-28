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
| 3 | `03_token_casefiles.sql` | `token_casefiles` | FIELD | 2 | ≤ 6 |
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

## Arbitrages rendus — 2026-08-28

Les deux questions ouvertes de ce README ont été tranchées. Le SQL n'a pas
bougé : les deux verdicts confirment le pack tel qu'il était écrit. La seule
correction porte sur le registre, hors SQL.

**1. `EvidenceSnapshot` reste en S1, `DECLARED`, 0 écriture — TRANCHÉ.** Les
deux documents se contredisaient : `BUILD2_DATA_NATURE_SPEC` §« S3 — périmètre
exact » l'incluait (1 159 lignes, exactement l'écart entre ses 2 911 lignes et
les 1 752 de ce pack), le registre `registry.ts` — plus tardif, mesuré, couvert
par le test I5 — la classe `DECLARED / S1`, au motif qu'une capture horodatée
avec artefact récupérable est mono-nature. **Le registre l'emporte : la réalité
mesurée récente prime sur une spec stale.**

L'écart 2 911 → 1 752 est donc un **SCOPE REFINEMENT, pas un manque.** Le
périmètre de S3 n'a pas été raboté pour tenir : il a été recalculé sur des
volumes remesurés, et une table en est sortie parce qu'elle n'a jamais eu
besoin d'y être. Ne pas lire ce delta comme 1 159 lignes laissées de côté.

`EvidenceSnapshot` ne passera en S3 que si on démontre **plus tard** qu'elle
porte des affirmations exigeant `DataNature` — pas au seul motif qu'elle porte
un snapshot probatoire. Conséquence directe : **pas de migration S3, pas de
backfill, pas de fichier `06_`.**

**2. `token_casefiles` : 2 lignes, et le registre est corrigé — TRANCHÉ.** Le
registre annonçait 1, la base en porte **2** (mesuré 2026-08-28) — un écart de
100 % sur la table qui porte M3, les 482 M$ estimés à côté des 1,5 M$
revendiqués. Décision : **on backfille les 2 lignes réelles, mais on corrige le
registre d'abord.** `registry.ts` passe donc à `rows: 2` dans ce même PR, avec
la date de remesure inscrite dans son `why`.

Le SQL du fichier 3 **ne change pas** : son backfill est déjà gardé par
`WHERE … IS NULL`, donc il classe ce qu'il trouve, 1 ligne ou 2. C'est le
registre qui était stale, pas la migration.

Ordre d'exécution pour le fichier 3 (founder, dans Neon SQL Editor) :

```sql
-- 1. AVANT — read-only, compte final. Attendu : 2.
SELECT count(*) FROM "token_casefiles";

-- 2. Exécuter 03_token_casefiles.sql (DDL + 3 UPDATE gardés IS NULL).

-- 3. APRÈS — post-check : 2 lignes sur 2 classées, aucune autre touchée.
SELECT count(*) AS total,
       count("rowNature") AS classees
  FROM "token_casefiles";
-- Attendu : total = 2, classees = 2.
```

Si le compte de l'étape 1 ne rend pas exactement **2**, on s'arrête : le
registre vient d'être remesuré, un troisième écart signifierait une écriture
non tracée sur la table.

**3. `EvidenceItem` : les 32 `MIGRATED_BACKFILL` restent non mappés —
CONFIRMÉ, rien ne change.** Cette valeur dit COMMENT la ligne est arrivée, pas
CE QU'ELLE EST. Elles restent `UNCLASSIFIED` avec les 1 070 `NULL`.

**Seules 2 lignes reçoivent une vraie nature** (`FIRST_PARTY_CAPTURE` →
`PRIMARY_OBSERVATION`, le seul mappage déterministe du fichier). Les 1 102
autres reçoivent `UNCLASSIFIED`, qui n'est pas un classement mais une
déclaration d'ignorance écrite noir sur blanc — et qui les exclut des sorties
publiques par la frontière S2. **Aucune nature par défaut n'est posée pour
« finir » la table.** Une table à moitié classée qui le dit vaut mieux qu'une
table entièrement classée qui ment.

La requête de vérification du fichier 4 rend le croisement
`(provenanceType, sourceType)` trié par volume : c'est la file de travail du
classement humain, du plus gros lot au plus petit.

**4. Les 39 estimations sans méthode** (`KolWallet` 29 + `KolCase` 10). Hors
périmètre de ce pack, mais c'est le **chemin critique** du plan : tant que
personne n'a écrit leur méthode ou ne les a déclassées, le `CHECK` de S5 ne peut
pas être posé. Ça ne se code pas.

## Après exécution

Le registre `src/lib/data-nature/registry.ts` devient vérifiable **contre la
base** et non plus seulement contre lui-même. Un test comparant les colonnes
réelles aux régimes déclarés fermerait la boucle — il n'existe pas encore.
