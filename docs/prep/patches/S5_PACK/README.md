# PACK S5 — `methodRef` réel, natures posées, et ce qui n'est pas une estimation

**À APPLIQUER À LA MAIN, UN FICHIER À LA FOIS. Rien n'a été exécuté.** Toutes
les mesures sont en lecture seule sur `ep-square-band`. Neon SQL Editor
uniquement, jamais `prisma migrate` (verrou A9, `P1012` à `getConfig`).

## ⛔ Un préalable

**S5-A doit être mergé** (PR #178). Le fichier 01 écrit
`financial-estimates/est-proceeds@v1` : cette référence ne vaut que si
l'artefact qu'elle cite est gelé sur main, avec
`contentSha256 = 078be1574cd15dea17d4b07cc6fb5de77f166646270350ae16fe90969601cdf2`.
Sinon on remplace un pointeur mouvant par un autre.

## Ordre d'exécution

| # | Fichier | Écrit | Lignes | Dépend de |
|---|---|---|---|---|
| 0 | `00_PREREQ_nature_columns.sql` | 2 colonnes | 0 | — |
| 1 | `01_S5B_kolcase_estimate_methodref.sql` | `rowNature` + `methodologyRef` | **7** | 00 · S5-A mergé |
| 2 | `02_S5C_kolwallet_third_party.sql` | `rowNature` | **29** | 00 |
| 3 | `03_S5D_kolcase_inference.sql` | `rowNature` | **3** | 00 |

Le fichier 00 est un prérequis dur : les trois autres écrivent dans les
colonnes qu'il pose. Les fichiers 01, 02 et 03 sont **mutuellement exclusifs** —
aucune ligne n'est visée par deux d'entre eux.

## Pourquoi le fichier 00 existe

S5 est le premier à vouloir écrire une nature sur `KolWallet` et `KolCase`, et
découvre qu'**aucune des deux ne porte de colonne de nature** :

```sql
SELECT table_name, count(*) FROM information_schema.columns
 WHERE udt_name = 'DataNature' GROUP BY 1;
-- EvidenceItem 1 · KolTokenInvolvement 2 · KolTokenLink 4
-- TokenPriceTracker 4 · token_casefiles 3        → 5 tables, 14 colonnes
```

Le registre les classe pourtant en régime ROW / étape S4 — mais S4 s'est limité
à `EvidenceItem`. Le manque n'apparaît qu'ici.

**Écrire dans `claimType` n'est pas la solution** : c'est un vocabulaire
d'origine, pas une nature. L'écraser détruirait la provenance et casserait
`checkPublishability` (`src/lib/kol/types.ts`), qui décide de la publiabilité
d'un profil en le lisant. Deux axes, deux colonnes.

**Aucune colonne de méthode n'est ajoutée à `KolWallet`** — exclu par S5-C :
les 29 lignes relaient un tiers, elles n'ont pas de méthode maison à
référencer, et une colonne vide inviterait à la remplir.

## État final attendu

`KolCase` — 11 lignes :

| `claimType` | `rowNature` | `methodologyRef` | n |
|---|---|---|---|
| `analytical_estimate` | `ESTIMATE` | `financial-estimates/est-proceeds@v1` | **7** |
| `analytical_estimate` | `INFERENCE` | `/en/methodology` | **3** |
| `source_attributed` | *(NULL)* | `/en/methodology` | **1** |

`KolWallet` — 482 lignes : **29** en `THIRD_PARTY_DATA`, **453** en `NULL`.

## Ce que chaque fichier fait

**01 — S5-B.** Les 7 lignes qui portent un chiffre reçoivent `ESTIMATE` **et** la
référence canonique. La référence **déclare que la méthode s'applique**, pas
qu'elle a été suivie : aucune trace de calcul, aucun `versionNote` n'existe sur
ces lignes. Écrit dans le fichier pour que personne ne la lise comme une preuve.

**02 — S5-C.** Les 29 `KolWallet` passent en `THIRD_PARTY_DATA`. Leur
`sourceLabel` dit `@dethective — winrate 29.77%` : ces PnL viennent d'un compte
X tiers, pas de notre pipeline. **Aucun `methodRef`** — s'en attribuer un serait
la fausse référence sous un nom plus flatteur. `claimType`,
`attributionStatus='review'`, `isPubliclyUsable=false` et l'absence de
`sourceUrl` **restent intouchés** : Data Nature ne répare pas leur provenance en
douce.

**03 — S5-D.** Les 3 `KolCase` **sans montant** passent en `INFERENCE`, **sans
aucune `methodologyRef` écrite**. Une estimation implique un chiffre estimé ;
ces lignes affirment seulement qu'un KOL a tenu un rôle dans un cas.

## Les propriétés de S3/S4, tenues

**Additif** — 2 `ADD COLUMN IF NOT EXISTS` nullables sans `DEFAULT`. Aucun
`DROP`, **aucun `DELETE`**.

**Rejouable** — chaque `UPDATE` gardé par `rowNature IS NULL`. Relancer ne
produit rien.

**Jamais d'`UPDATE` global** — 3 `UPDATE`, chacun avec son prédicat et son
compte attendu. **Une cardinalité différente = ARRÊT**, rollback en pied de
chaque fichier.

**Aucune nature fabriquée pour finir.** Les 453 autres `KolWallet` et la 11ᵉ
`KolCase` gardent `rowNature = NULL` : aucune nature n'a été prononcée sur
elles. `NULL` ne veut pas dire « oubli », il veut dire « rien n'a été décidé ».

## Findings consignés — NE PAS corriger dans S5

**DN-F1 · sémantique de publiabilité.** `checkPublishability`
(`src/lib/kol/types.ts:90`) traite implicitement tout `paidUsd` comme une
« estimation nécessitant une méthode » — son commentaire dit *Estimated
figures*, son prédicat dit `c.paidUsd`. À terme, distinguer **montant observé /
tiers attribué / estimé**. La règle devrait s'indexer sur la nature, pas sur la
présence d'un montant.

**DN-F2 · affirmation monétaire tierce non attribuée.** La 11ᵉ ligne
(`planted`/`BOTIFY`, 450 000 $) est `source_attributed` avec **`sourceLabel` ET
`sourceUrl` à NULL** : un chiffre déclaré « attribué à une source » dont la
source n'est nommée nulle part. Plus préoccupant que la question du `methodRef`.
Sa `methodologyRef` est **conservée** (consumer réel).

**DN-F3 · le `DEFAULT` continue de produire la référence stale.** Mesuré :
`KolCase.methodologyRef` porte `DEFAULT '/en/methodology'::text` en base. Le
fichier 01 corrige les 7 lignes existantes, mais **toute nouvelle ligne naîtra
avec la route legacy**. Changer un `DEFAULT` est un DDL hors périmètre ratifié —
signalé, non corrigé.

**Entity/Attribution Integrity.** Une des 29 (`HdKJM6Lvfp9aV9tvEMC8AD4GnsbFgMUkHLoK923Sn1ET`)
est une **PDA de programme représentée comme portefeuille** — vérifié via
`getAccountInfo`, note du 2026-08-28. S5-C la déclasse comme les 28 autres ; il
ne répare pas le fait qu'un PnL de portefeuille est attribué à un objet qui n'en
est pas un. Deux défauts, un seul traité.

**W2 · les 482 M$.** Constante de seed (`prisma/seed-lab.ts:430`) **sans
dérivation**. **JAMAIS de `est-proceeds@v1` rétroactif** : la ressemblance
thématique ne vaut pas dérivation, et inventer la dérivation après coup est
précisément l'interdit. Chantier séparé.

## Après le fichier 00

Merger la PR **#181** (`chore(schema)` — `KolWallet.rowNature` +
`KolCase.rowNature`, en draft), puis refermer l'exemption guard **#180**
(`aa1a65f`) byte-identique. Ordre impératif : le schéma ne peut pas partir avant
que les colonnes existent, sinon toute lecture des deux modèles casse en prod.

## S5 n'est pas clos

Restent **W2** (les 482 M$) et le passage **S6 / Q5**.
