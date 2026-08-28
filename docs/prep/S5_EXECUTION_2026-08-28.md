# S5 — exécution S5-A → S5-F
### 2026-08-28 · S5-A livré en PR · pack B/C/D écrit, **non exécuté** · aucune écriture base

Mesures en lecture seule sur `ep-square-band` (`SET default_transaction_read_only = on`,
`BEGIN READ ONLY`, `ROLLBACK`), plus lecture du dépôt et de l'historique git.

---

## S5-A — la méthode est gelée · **PR #178**

`content/methodologies/financial-estimates/v1.md` — `status: FROZEN`,
`effectiveFrom: 2026-03-19`, provenance `63951bb`, 7 composants à identifiants
stables, `appliesTo` nommant les colonnes gouvernées, et
`contentSha256 = 078be1574cd15dea17d4b07cc6fb5de77f166646270350ae16fe90969601cdf2`.

**Extrait de la page publiée sans une virgule de changement** — mêmes titres,
même ordre, mêmes textes, vérifié par comparaison programmatique avant/après
(7 rubriques, identiques). Geler une méthode n'est pas l'occasion de la
réécrire : l'ordre initial de l'artefact plaçait `est-proceeds` en tête et
renommait les rubriques ; c'était une modification silencieuse d'une page
publique, corrigée avant commit.

`/en/methodology` **rend** désormais l'artefact et ne contient plus aucun corps
de méthode en dur — vérifié rubrique par rubrique par test.

**Convention** : `<methodology>/<component>@<version>`. `resolveMethodRef` rend
`null` plutôt que de deviner ; `legacy`, `/en/methodology`, version manquante,
version inexistante et composant inconnu sont refusés **par test**.

**10 tests verts**, `tsc` propre, guard vert — aucun chemin gelé, donc
**aucune exemption nécessaire**.

*Écart de mise en œuvre assumé* : le fichier est
`content/methodologies/financial-estimates/v1.md` avec `est-proceeds` comme
composant, plutôt qu'un dossier `est-proceeds/v1`. Les règles qui gouvernent
`est-proceeds` (pricing, time basis, inclusions/exclusions, realized vs
unrealized) sont des rubriques sœurs : les séparer aurait forcé à les dupliquer
ou à laisser la moitié de la page hors artefact — la page n'aurait plus été une
vue. **La référence produite est exactement celle demandée.**

*Constaté* : `/fr/methodology` ne porte pas cette section. La méthode des
estimations financières n'est publiée **qu'en anglais**.

---

## S5-B / C / D — pack écrit, non exécuté

`docs/prep/patches/S5_PACK/` — 4 fichiers, 3 `UPDATE`, 2 `ADD COLUMN`,
**0 `DELETE`**.

| Fichier | Écrit | Lignes |
|---|---|---|
| `00_PREREQ_nature_columns.sql` | `rowNature` sur `KolWallet` + `KolCase` | 0 |
| `01_S5B_kolcase_estimate_methodref.sql` | `rowNature=ESTIMATE` + `methodologyRef` | **7** |
| `02_S5C_kolwallet_third_party.sql` | `rowNature = THIRD_PARTY_DATA` | **29** |
| `03_S5D_kolcase_inference.sql` | `rowNature = INFERENCE` | **3** |

**Ratifié le 2026-08-28, resserré :** S5-B ne vise plus que les **7 lignes qui
portent un chiffre** (`paidUsd IS NOT NULL`), et leur écrit `rowNature =
ESTIMATE` en plus de la référence. Les 3 lignes sans montant ne reçoivent
**aucune** `methodologyRef` — une méthode d'estimation sur une ligne qui
n'estime rien serait la fausse référence que S5 combat.

### Le blocage qui a imposé le fichier 00

S5-C et S5-D demandent d'écrire une nature sur `KolWallet` et `KolCase`.
**Ni l'une ni l'autre ne porte de colonne de nature** — seules 5 tables en ont
(`EvidenceItem`, `KolTokenInvolvement`, `KolTokenLink`, `TokenPriceTracker`,
`token_casefiles`). Le registre les classe pourtant en régime ROW / étape S4,
mais S4 s'est limité à `EvidenceItem` : ces deux tables n'ont jamais reçu leur
colonne, et le manque n'apparaît qu'ici parce que S5 est le premier à vouloir y
écrire une nature.

Écrire dans `claimType` aurait été tentant et faux : c'est un vocabulaire
d'origine, pas une nature, et l'écraser casserait `checkPublishability`
(`src/lib/kol/types.ts`), qui décide de la publiabilité en le lisant.

**Le fichier 00 est à ratifier avant exécution.** Il n'ajoute **aucune** colonne
de méthode à `KolWallet` — exclu par S5-C, et une colonne vide inviterait à la
remplir.

---

## S5-E — la 11ᵉ ligne : **CONSERVER**, elle porte un consumer réel

`planted` / `BOTIFY` / `co_promoter` · `paidUsd = 450 000` ·
`claimType = 'source_attributed'` · `confidenceLevel = 'confirmed'` ·
`methodologyRef = '/en/methodology'` · `evidence` = « Promotion alongside
@bkokoski during BOTIFY active period. »

### Le consumer existe, et il est décisif

`src/lib/kol/types.ts:90`, dans `checkPublishability` :

```ts
// 2. Estimated figures must have methodology ref
cases.forEach(c => {
  if (c.paidUsd && !c.methodologyRef) {
    warnings.push(`Case ${c.caseId}: estimated figure shown without methodology reference.`)
  }
})
```

La règle est indexée sur **la présence d'un montant**, pas sur `claimType`.
Retirer la référence de cette ligne — qui porte 450 000 $ — **déclencherait un
avertissement de publiabilité**. La référence est porteuse.

→ **Conservée en l'état.** Elle n'est pas migrée vers
`financial-estimates/est-proceeds@v1` : `est-proceeds` est une méthode
d'**estimation**, et cette ligne est `source_attributed`. Lui coller cette
référence serait le mensonge que S5 combat. La colonne portera donc deux
vocabulaires après le fichier 01 — voulu, transitoire, documenté.

### Deux choses que l'enquête a fait apparaître, non corrigées ici

1. **La règle confond « chiffre monétaire » et « estimation ».** Son commentaire
   dit *Estimated figures*, son prédicat dit `c.paidUsd`. Une ligne
   `source_attributed` chiffrée tombe donc sous une règle écrite pour les
   estimations. La règle devrait s'indexer sur la nature ou le `claimType`.
2. **`source_attributed` sans source nommée.** Cette ligne porte `sourceLabel =
   NULL` **et** `sourceUrl = NULL` : un chiffre de 450 000 $ déclaré « attribué à
   une source » dont la source n'est nommée nulle part. C'est un problème plus
   lourd que la question du `methodRef`, et il est hors périmètre S5.

La référence n'est **pas** supprimée à l'aveugle, conformément à l'arbitrage.

---

## S5-F — les deux findings, bornés et NON corrigés

### FINDING 1 — intégrité de type : une PDA représentée comme portefeuille

**Portée : 1 ligne.** `KolWallet` `HdKJM6Lvfp9aV9tvEMC8AD4GnsbFgMUkHLoK923Sn1ET`,
`kolHandle = 'deployer_pool'`, une des 29.

Son `attributionNote`, posée le 2026-08-28, est explicite : vérifié via
`getAccountInfo`, **le compte est détenu par un programme — c'est une PDA, pas
un portefeuille contrôlé par une clé privée**. `confidence` rétrogradée à `low`,
ligne conservée, `attributionStatus = 'review'`, non publiable.

**Ce que S5-C fait pour elle** : elle passe en `THIRD_PARTY_DATA` comme les 28
autres. **Ce que S5-C ne fait pas** : réparer le fait qu'un PnL de portefeuille
est attribué à un objet qui n'est pas un portefeuille. Deux défauts distincts,
un seul traité. À dire explicitement pour que personne ne croie la ligne
assainie par le déclassement.

Chantier séparé : décider si une PDA a sa place dans `KolWallet`, ou si elle
relève d'une autre entité.

### FINDING 2 — W2 : les 482 M$ sans dérivation

`token_casefiles.estimatedRetailHarmUsd = 482 000 000` sur `IL-PND-LAB-001`
($LAB), classé `ESTIMATE` par S3.

Deux constats, **aucune conclusion** :

1. **C'est une constante de seed** : `prisma/seed-lab.ts:430` →
   `estimatedRetailHarmUsd: BigInt(482_000_000)`. Aucune dérivation adjacente.
2. **Le même fichier sait documenter ses chiffres quand il en a la base** : le
   `$76.6M` voisin est accompagné de sa dérivation (« 136 millions de tokens LAB
   déposés sur Bitget en deux phases »), et les `sources` listent
   `@SpecterAnalyst` et `@zachxbt` avec URL et date. Le 482 M$, non.

**Ce chiffre n'est PAS rattaché à `est-proceeds@v1`.** La ressemblance
thématique avec `est-investor-losses` ne vaut pas dérivation — et inventer la
dérivation après coup est précisément ce qui est interdit.

Chantier séparé, dans cet ordre : **(1)** retrouver une dérivation vérifiable ;
**(2)** si elle existe et correspond à une méthodologie gelée → `ESTIMATE` +
`methodRef` ; **(3)** sinon, ce chiffre **ne peut plus être présenté comme une
estimation méthodologiquement démontrée**. Signalé, non tranché.

---

## `retailLossEstimateUsd` — la règle est écrite, le `CHECK` attend

0 ligne renseignée sur 15. `RETAIL_LOSS_ESTIMATE_RULE`
(`src/lib/methodology/registry.ts`) déclare : *si montant non-NULL et nature =
`ESTIMATE`, un `methodRef` résolvant sur un artefact gelé est requis*, composant
applicable `financial-estimates/est-investor-losses`.

**Aucun `CHECK` en base**, délibérément : une contrainte écrite avant le premier
writer réel se heurterait à un chemin d'écriture qui n'existe pas et que
personne ne saurait tester. Le `CHECK` attend ce writer et ses tests. La règle
est écrite maintenant pour que le writer naisse en la connaissant.

---

## Dette laissée en place, explicitement

`KolProceedsSummary.methodologyVersion` porte `v1` (27 lignes) et `v1-seed` (1) :
une version **sans slug**, qui dit quelle version sans jamais dire de quoi. Hors
de la convention canonique, à y mapper plus tard. **Ne bloque pas S5** — noté
dans `src/lib/methodology/registry.ts`.

---

## FINDING SUPPLÉMENTAIRE — DN-F3 · le `DEFAULT` reproduit la référence stale

Mesuré en écrivant la PR de schema : `KolCase.methodologyRef` porte
`DEFAULT '/en/methodology'::text` **en base**. Le fichier 01 corrige les
7 lignes existantes, mais **toute nouvelle ligne naîtra avec la route legacy**.
La correction des données ne referme pas la source.

Changer un `DEFAULT` est un DDL hors du périmètre ratifié : signalé, non corrigé.

---

## Chaîne d'exécution

| Étape | État |
|---|---|
| S5-A — artefact gelé | **PR #178**, 10 tests verts |
| Exemption guard (2 colonnes) | **mergée — `aa1a65f`** (PR #180) |
| Pack S5 `00/B/C/D` | **PR #179**, non exécuté |
| Recalage schema `rowNature` ×2 | **PR #181, draft** — après le fichier 00 |
| Refermeture guard byte-identique | après #181 |

## S5 n'est PAS clos

Restent **W2** (les 482 M$ sans dérivation) et le passage **S6 / Q5**.
