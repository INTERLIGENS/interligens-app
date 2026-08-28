# BACKLOG — chantier `EvidenceItemAssertion`
### Ouvert le 2026-08-28 à la clôture de S4 · 34 pièces · aucune ligne de code écrite

## Ce qui ouvre ce backlog

S4 a classé 1 063 `EvidenceItem` sur 1 104. **34 pièces sont restées
`UNCLASSIFIED` pour une seule et même raison** : leur contenu porte des
affirmations de natures différentes, et `rowNature` n'accepte qu'une valeur.

Motifs canoniques : `MIXED_ASSERTION_ARTIFACT` / `ROW_LEVEL_MODEL_INSUFFICIENT`.

## La doctrine qui les tient

> Un `EvidenceItem` dont les affirmations sont de natures **non homogènes**
> reste `UNCLASSIFIED` jusqu'à classification au niveau **assertion**.
> `rowNature` ne force **jamais** une nature globale.

**`UNCLASSIFIED` ≠ `EXCLUDED`.** Ces 34 pièces sont **dans** la chaîne
probatoire : elles comptent, elles sont opposables, elles attendent seulement
un classement plus fin. Les 7 pièces exclues par `S4_PACK/05` portent
`evidentiaryStatus = 'EXCLUDED'` et ne participent plus aux chaînes de preuve.
Deux états, deux colonnes, deux significations — les confondre ferait
disparaître 34 pièces valides.

## Le prédicat canonique de l'ensemble

```sql
SELECT * FROM "EvidenceItem"
 WHERE "rowNature" = 'UNCLASSIFIED'
   AND "evidentiaryStatus" IS NULL;   -- 34 lignes au 2026-08-28
```

Il se lit en une phrase : **non classé, et non exclu**. Aucune colonne
supplémentaire n'a été nécessaire pour désigner l'ensemble — c'est la
conjonction des deux états qui le définit, et c'est voulu.

## Les 34 pièces

| Famille | n | Détail | Natures mélangées |
|---|---|---|---|
| PDF de cas générés | **28** | `reports/GordonGekko/CASE_GordonGekko_*.pdf` | `INFERENCE` + `ESTIMATE` + `EDITORIAL_ASSERTION`, **et circularité** |
| PDF de cas générés | **4** | `reports/deployer_pool/CASE_deployer_pool_*.pdf` | idem |
| Rapport de scan | **1** | `BOTIFY_KOL_SCAN_REPORT.json` — sha `1608ed3e…`, 10 378 o | `INFERENCE` (txCount, totalUsdCashout agrégés on-chain) + `ESTIMATE` (`solPriceEstimate: 200`, `usdDeal`) |
| Graphe de sauts | **1** | `sxyz500_hops.json` — sha `9cc752c6…`, 1 578 o | `INFERENCE` (hopIndex, amountUsd) + `EDITORIAL_ASSERTION` (`_note` rédigé sur **les 6 entrées**) |

Les 32 PDF portent tous `timestampMode = 'retroactive'` et **aucune TSA**.

## Ce que le chantier devra produire

Un porteur de nature **au niveau assertion**, que le modèle actuel n'a pas.
Forme pressentie, non ratifiée :

```
EvidenceItemAssertion(evidenceItemId, assertionRef, nature, methodRef, createdAt)
```

`assertionRef` ancre l'affirmation dans le document (section, page, clé JSON).
`methodRef` sera exigé sur les `ESTIMATE` par S5.

**Le coût n'est pas la migration.** Créer la table est trivial ; la remplir
suppose de lire 34 documents et d'énumérer leurs affirmations une par une. Ça
ne se code pas, et c'est pourquoi la table n'a pas été créée vide à la clôture
de S4 : une table vide aurait donné l'illusion que le chantier avait commencé.

## Deux règles qu'aucune colonne ne porte encore

**1. Circularité.** Un PDF généré par INTERLIGENS n'est **jamais** preuve
primaire de ses propres conclusions : il est le record de ce qu'INTERLIGENS a
conclu et publié à une date, pas une preuve indépendante. Aujourd'hui cette
règle ne tient que par le fait que ces 32 lignes restent non classées — une
garantie **par omission**, donc fragile : le jour où quelqu'un les classera
sans connaître la règle, elle disparaîtra sans bruit.

**2. La doctrine elle-même n'est pas exécutable.** `src/lib/data-nature/`
ignore la notion d'artefact à affirmations mixtes : rien, dans le code, n'empêche
d'écrire une `rowNature` sur l'une de ces 34 pièces. La doctrine vit dans ce
document et dans le fichier 06 du pack, pas dans un test. **La rendre
opposable — invariant ou test — reste à faire, et n'est pas dans S4.**

## Ce que ce backlog n'est pas

Ce n'est pas une file de travail S5. S5 porte sur les `methodRef` des `ESTIMATE`
existantes (39 estimations sans méthode, `KolWallet` 29 + `KolCase` 10) et sur
la contrainte qui les accompagne. Le chantier `EvidenceItemAssertion` est
indépendant et sans date.
