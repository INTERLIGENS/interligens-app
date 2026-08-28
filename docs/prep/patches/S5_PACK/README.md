# PACK S5 — `methodRef` réel, et déclassement de ce qui n'est pas une estimation

**À APPLIQUER À LA MAIN. Rien n'a été exécuté.** Toutes les mesures sont en
lecture seule sur `ep-square-band`. Neon SQL Editor uniquement, jamais
`prisma migrate` (verrou A9, `P1012` à `getConfig`).

## ⛔ Deux préalables, dans cet ordre

**1. S5-A doit être mergé** (PR #178). Le fichier 01 écrit
`financial-estimates/est-proceeds@v1` : cette référence ne vaut que si
l'artefact qu'elle cite est gelé sur main, avec
`contentSha256 = 078be1574cd15dea17d4b07cc6fb5de77f166646270350ae16fe90969601cdf2`.
Sinon on remplace un pointeur mouvant par un autre.

**2. Le fichier 00 doit être RATIFIÉ.** Il ajoute deux colonnes. Sans lui, S5-C
et S5-D sont littéralement inécrivables — voir ci-dessous.

## Le blocage découvert en écrivant le pack

S5-C demande d'écrire une nature sur 29 `KolWallet`, S5-D sur 3 `KolCase`.
**Aucune de ces deux tables ne porte de colonne de nature.** Mesuré :

```sql
SELECT table_name, count(*) FROM information_schema.columns
 WHERE udt_name = 'DataNature' GROUP BY 1;
-- EvidenceItem 1 · KolTokenInvolvement 2 · KolTokenLink 4
-- TokenPriceTracker 4 · token_casefiles 3        → 5 tables, 14 colonnes
```

Le registre classe pourtant `KolWallet` et `KolCase` en régime ROW / étape S4 —
mais S4 s'est finalement limité à `EvidenceItem`. Ces deux tables n'ont jamais
reçu leur colonne, et le manque n'apparaît qu'ici parce que S5 est le premier à
vouloir y écrire une nature.

**Écrire dans `claimType` n'est pas la solution** : c'est un vocabulaire
d'origine, pas une nature. L'écraser détruirait la provenance et casserait
`checkPublishability` (`src/lib/kol/types.ts`), qui décide de la publiabilité
d'un profil en lisant `claimType`. Deux axes, deux colonnes.

D'où le fichier 00 : `rowNature` sur les deux tables, nullable, sans `DEFAULT`.
**Aucune colonne de méthode n'est ajoutée à `KolWallet`** — explicitement exclu
par S5-C, et une colonne vide inviterait à la remplir.

## Ordre d'exécution

| # | Fichier | Écrit | Lignes | Dépend de |
|---|---|---|---|---|
| 0 | `00_PREREQ_nature_columns.sql` | 2 colonnes | 0 | **ratification** |
| 1 | `01_S5B_kolcase_methodref.sql` | `methodologyRef` | **10** | S5-A mergé |
| 2 | `02_S5C_kolwallet_third_party.sql` | `rowNature` | **29** | fichier 00 |
| 3 | `03_S5D_kolcase_inference.sql` | `rowNature` | **3** | fichier 00 |

Le fichier 01 est indépendant du 00 : il écrit dans `methodologyRef`, qui
existe déjà. Il peut passer dès que S5-A est mergé, même si le 00 attend.

## Ce que chaque fichier fait

**01 — S5-B.** `/en/methodology` (une route) → `financial-estimates/est-proceeds@v1`
(un composant d'artefact gelé) sur les 10 lignes `analytical_estimate`. La
référence **déclare que la méthode s'applique**, pas qu'elle a été suivie :
aucune trace de calcul, aucun `versionNote` n'existe sur ces lignes. Écrit dans
le fichier pour que personne ne la lise comme une preuve de calcul.

**02 — S5-C.** Les 29 `KolWallet` passent en `THIRD_PARTY_DATA`. Leur
`sourceLabel` dit `@dethective — winrate 29.77%` : ces PnL viennent d'un compte
X tiers, pas de notre pipeline. Aucun `methodRef` — s'en attribuer un serait la
fausse référence que la doctrine interdit. `claimType`, `attributionStatus`,
`isPubliclyUsable` et l'absence de `sourceUrl` **restent intouchés** : ce sont
des dimensions distinctes.

**03 — S5-D.** Les 3 `KolCase` `analytical_estimate` **sans montant** passent en
`INFERENCE`. Une estimation implique un chiffre estimé ; ces lignes affirment
seulement qu'un KOL a tenu un rôle dans un cas. Le nom legacy ne dicte pas la
nature.

## Les propriétés de S3/S4, tenues

**Additif** — 2 `ADD COLUMN IF NOT EXISTS` nullables sans `DEFAULT`. Aucun
`DROP`, **aucun `DELETE`**.

**Rejouable** — chaque `UPDATE` gardé par un état (`rowNature IS NULL`, ou la
valeur actuelle exacte pour le 01). Relancer ne produit rien.

**Jamais d'`UPDATE` global** — 3 `UPDATE`, chacun avec son prédicat et son
compte attendu. Un compte qui diverge = arrêt.

**Aucune nature fabriquée pour finir.** Les 453 autres `KolWallet` et les
7 `KolCase` chiffrées gardent `rowNature = NULL` : aucune nature n'a été
prononcée sur elles. `NULL` ne veut pas dire « non classé par oubli », il veut
dire « rien n'a été décidé ».

## Deux points portés à ratification

1. **Les 7 `KolCase` avec montant** restent `rowNature = NULL`. Les passer à
   `ESTIMATE` serait cohérent avec le fichier 03 — mais l'arbitrage ne l'a pas
   prononcé, et « aucune nature fabriquée » l'emporte sur la symétrie.
2. **Le `methodRef` des 3 lignes sans montant.** Le fichier 01 le leur écrit
   (l'arbitrage S5-B porte sur les 10). Une méthode d'estimation sur une ligne
   classée `INFERENCE` se défend — elle décrit ce qui s'appliquera quand un
   montant sera écrit — mais se discute. Pour les en exclure : ajouter
   `AND "paidUsd" IS NOT NULL` au prédicat du 01, qui rend alors 7 au lieu de 10.

## Après exécution, la colonne portera deux vocabulaires

`KolCase.methodologyRef` : 10 références canoniques + 1 route legacy
(`/en/methodology`, la 11ᵉ ligne). C'est **voulu** — voir S5-E : cette référence
a un consumer réel et n'est pas retirée à l'aveugle. Ne pas « uniformiser ».
