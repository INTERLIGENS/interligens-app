# BUILD 2 — DATA NATURE : spécification de fondation

**Date :** 2026-08-27
**Terminal :** T2, branche jetable `t2-audit-riskclass`
**Mode :** READ_ONLY / design. **Aucune écriture, aucun merge, aucune migration, aucun `ALTER`.**
Neon `ep-square-band` en `BEGIN TRANSACTION READ ONLY`, hôte vérifié avant connexion.
**Entrée :** `docs/prep/DATA_NATURE_discovery_2026-08-27.md` (178 tables, 0 colonne `nature`,
sites de mélange M1–M7, confiance éclatée en 27 colonnes / 7 formes).
**Sortie :** une spécification à ratifier. Rien n'est exécuté ici.

---

## Correction du discovery, à faire d'emblée

Le discovery concluait à **deux** vocabulaires réutilisables couvrant 4 natures sur 5. C'était une
sous-estimation, et la cause est méthodologique : la recherche portait sur des **noms de colonnes**.
Un balayage des types énumérés de la base en révèle **cinq de plus**, dont un qui est déjà une
taxonomie de nature typée :

| Vocabulaire | Forme | Valeurs | Colonnes |
|---|---|---|---|
| **`MmClaimType`** | **enum Postgres** | `FACT, ALLEGATION, INFERENCE, RESPONSE` | 2 |
| `MmAttribMethod` | enum | `ARKHAM, HACK_LEAK, OFFICIAL, OSINT, INFERRED_CLUSTER, COURT_FILING` | 1 |
| `MmSourceType` | enum | `DOJ, CFTC, SEC, COURT, REGULATOR, MEDIA_TIER1..3, OSINT, OFFICIAL, HACK_LEAK` | 2 |
| `MatchBasis` | enum | `EXACT_*, INFERRED_LINKAGE, FUZZY_ALIAS` | 2 |
| `GovernedStatusBasisEnum` | enum | `manual_internal_confirmation, external_authority_source, multi_source_corroboration, legacy_case_linkage` | 1 |
| `RwaSourceType` | enum | `OFFICIAL_DOCS … ORACLE, INTERNAL_VERIFICATION` | 1 |
| `KolWallet.claimType` / `KolCase.claimType` | text libre | `source_attributed`, `analytical_estimate`, `verified_onchain`, `attributed`, `onchain_confirmed`, `self_posted` | 2 |
| `EvidenceItem.provenanceType` | text libre | `MIGRATED_BACKFILL`, `FIRST_PARTY_CAPTURE` | 1 |

Deux conséquences pour cette spec, et elles vont dans des sens opposés.

**La bonne :** la maison sait déjà déclarer un vocabulaire fermé — **60 enums Postgres** et
**21 contraintes `CHECK ... = ANY(ARRAY[...])`** existent. Introduire `DataNature` n'invente aucune
convention ; ça en applique une.

**La mauvaise :** le produit ne manque pas de vocabulaire de nature, il en a **huit qui se
chevauchent sans se parler**, chacun mélangeant *nature*, *méthode* et *source* sur un seul axe.
`MmAttribMethod` range `ARKHAM` (un tiers), `OSINT` (une méthode) et `INFERRED_CLUSTER` (une
nature) dans la même énumération. Le problème n'est pas l'absence d'étiquette : **c'est que
personne n'a séparé les axes.**

---

## 1. La taxonomie canonique

### 1.1 Les cinq natures

| Nature | Ce qu'elle affirme | Qui en répond | Falsifiable par |
|---|---|---|---|
| `PRIMARY_OBSERVATION` | « nous l'avons constaté, à cette date, et l'artefact est récupérable » | INTERLIGENS | rejouer l'observation |
| `THIRD_PARTY_DATA` | « X l'affirme ; nous le relayons sans le reprendre à notre compte » | le tiers | contester X, ou constater qu'il ne l'a jamais dit |
| `INFERENCE` | « ceci se déduit par calcul de ce qui précède » | INTERLIGENS | rejouer le calcul sur les mêmes entrées |
| `ESTIMATE` | « nous chiffrons une grandeur qu'aucune observation ne peut établir » | INTERLIGENS | contester la **méthode**, jamais le chiffre seul |
| `EDITORIAL_ASSERTION` | « un humain d'INTERLIGENS l'affirme et l'assume » | l'auteur nommé | apporter une preuve contraire |

La ligne qui sépare `INFERENCE` de `ESTIMATE` est la seule qui demande de l'attention :
**une INFERENCE est vérifiable en la rejouant ; une ESTIMATE ne l'est jamais.** `dumpPct` se
recalcule à partir de deux prix — INFERENCE. `estimatedRetailHarmUsd = 482 000 000` ne se
recalcule pas : il dépend d'hypothèses sur des victimes qu'on n'a pas comptées — ESTIMATE.

### 1.2 La procédure de classement — cinq questions, dans cet ordre

Deux personnes doivent classer la même donnée pareil. D'où un ordre, pas une liste.

```
1. Un humain d'INTERLIGENS l'a-t-il affirmé en engageant sa responsabilité ?   → EDITORIAL_ASSERTION
2. Est-ce une grandeur qu'aucune observation ne pourrait jamais trancher ?      → ESTIMATE
3. Est-ce produit par un calcul déterministe sur d'autres données du produit ?  → INFERENCE
4. Est-ce reproduit d'un publieur externe, sans transformation de sens ?        → THIRD_PARTY_DATA
5. L'avons-nous constaté nous-mêmes, horodaté, avec artefact récupérable ?      → PRIMARY_OBSERVATION
   sinon                                                                        → UNCLASSIFIED (bloquant)
```

**Règle d'arbitrage quand deux réponses conviennent : la nature la MOINS autoritaire l'emporte.**
Ce n'est pas de la prudence rhétorique, c'est la conclusion du discovery : les sept sites de
mélange M1–M7 fautent **tous dans le même sens** — une inférence ou une assertion prend l'apparence
d'une observation. L'ordre ci-dessus place donc `EDITORIAL_ASSERTION` en premier : c'est la seule
lecture qui rende le sur-classement impossible par construction.

### 1.3 L'axe de confiance est SÉPARÉ, et non comparable entre natures

Réponse à Q2, développée en §2.2. En une phrase ici : `confidence` ne se compare **qu'à l'intérieur
d'une nature**. `AddressLabel` porte aujourd'hui `high` pour OFAC SDN (779 lignes) *et* pour les
4 étiquettes de source `INTERLIGENS` : deux `high` incommensurables dans la même colonne.

---

## 2. Les six questions bloquantes — décisions

### Q1 — La nature est-elle un attribut de LIGNE, de COLONNE, ou de CHAMP ?

**Décision : d'aucun des trois. La nature est l'attribut d'une AFFIRMATION.** La ligne, la colonne
et le champ ne sont que trois façons de loger une affirmation, et le produit utilise les trois.
D'où **trois régimes**, choisis par une règle mécanique, pas au cas par cas.

**La règle :** compter les natures distinctes que les colonnes d'une table peuvent porter.

| Natures portées | Régime | Où la nature est écrite | Coût |
|---|---|---|---|
| **1** | **DÉCLARÉ** | dans un registre de code, **pas de colonne** | zéro DDL |
| **≥ 2, mais séparables par un prédicat sur des colonnes existantes** | **DÉCLARÉ + PRÉDICAT** | une fonction dans le registre, **pas de colonne** | zéro DDL |
| **≥ 2, non séparables sans intervention humaine** | **LIGNE** | une colonne `nature` | 1 colonne + backfill |
| **≥ 2 simultanées dans la MÊME ligne** | **CHAMP** | une colonne compagnon `<champ>Nature` par champ gouverné | n colonnes |

Le régime **DÉCLARÉ + PRÉDICAT** est ce qui décide de la faisabilité du plan. Une table peut porter
deux natures et n'exiger **aucune écriture**, dès lors qu'une colonne déjà présente les sépare de
façon déterministe. C'est le cas des deux plus grosses tables du produit.

Application aux tables du discovery :

| Table | Natures | Régime | Ce qu'on ajoute |
|---|---|---|---|
| `intel_source_observations` (352 840) | THIRD_PARTY_DATA seule | **DÉCLARÉ** | rien |
| `AddressLabel` (217 813), `DomainLabel` (631 391) | THIRD_PARTY_DATA, sauf `sourceName='INTERLIGENS'` (4 lignes) | **DÉCLARÉ + PRÉDICAT** | rien — `sourceName` sépare déjà |
| `EvidenceSnapshot` (1 159) | PRIMARY_OBSERVATION seule | **DÉCLARÉ** | rien |
| `intel_canonical_entities` (350 012) | INFERENCE seule (`riskClass` calculé) | **DÉCLARÉ** | rien |
| `TokenPriceTracker` (340) | THIRD_PARTY (`currentPrice`) + INFERENCE (`peakPrice`, `dumpPct`) | **CHAMP** | 2 colonnes |
| `token_casefiles` (1) | THIRD_PARTY (`claimedRaiseUsd`) + ESTIMATE (`estimatedRetailHarmUsd`) + EDITORIAL (le dossier) | **CHAMP** | 2 colonnes + défaut de ligne |
| **`KolTokenLink` (292)** | **4** : PRIMARY (`contractAddress`), EDITORIAL (`note`), INFERENCE (`canonicalMint`), + `sourceType` | **CHAMP** | 3 colonnes |

**Pourquoi une colonne compagnon et pas un `jsonb {champ: nature}` :** un jsonb ne se contraint pas
(`CHECK` inopérant sur ses valeurs), ne s'indexe pas utilement à 350 000 lignes, et rend invisible
à `information_schema` le fait qu'un champ est gouverné. Une colonne nommée est interrogeable,
contraignable, et **visible dans le schéma** — ce qui est précisément ce qui manquait.

**Ce que la règle règle pour `KolTokenLink` :** défaut de ligne `EDITORIAL_ASSERTION` quand
`sourceType='manual_seed'`, `PRIMARY_OBSERVATION` quand `sourceType='watcher'` ; puis
`canonicalMintNature = INFERENCE` sur les 107 lignes du bridge, et `noteNature = EDITORIAL_ASSERTION`
partout où `note` est non nul. Les 117 lignes à adresse `PENDING:*` ne portent aucune identité :
leur `contractAddressNature` est `UNCLASSIFIED`, ce qui les exclut de toute sortie publique — et
c'est le comportement voulu.

### Q2 — Nature et confiance : un axe ou deux ?

**Décision : deux axes, jamais fusionnés, et la confiance n'est comparable qu'à nature égale.**

La preuve est dans `AddressLabel` : `confidence='high'` y signifie « OFAC l'a inscrit sur sa liste »
(779 lignes) *et* « nous l'affirmons » (4 lignes). Les fusionner reviendrait à dire que nos quatre
étiquettes valent une liste de sanctions souveraine — ce que personne n'a décidé, et que le schéma
affirme aujourd'hui par défaut.

Conséquences opérationnelles :
1. **Aucun tri, seuil ou filtre ne doit s'appliquer à `confidence` sans fixer la nature d'abord.**
   Un `WHERE confidence='high'` sans clause de nature est un bug par construction ; c'est
   détectable en revue et testable.
2. Les 27 colonnes `confidence*` sur 7 formes ne sont **pas** dans le périmètre de BUILD 2. Les
   unifier est un chantier distinct, et il devient beaucoup plus simple une fois la nature posée :
   on n'unifie plus « la confiance », on unifie « la confiance *dans une observation* », etc.
3. **`SOURCE_AUTHORITY` du résolveur V3 est déjà un classement de natures qui s'ignore.** Il ordonne
   `casefile > curated > mentions > dexscreener > onchain` — soit EDITORIAL > EDITORIAL > PRIMARY >
   THIRD_PARTY > PRIMARY. L'ordre mélange les deux axes, et c'est pour ça qu'il place une
   observation on-chain **sous** un catalogue tiers. À reprendre quand la taxonomie sera ratifiée.

### Q3 — Une INFERENCE dérivée d'un THIRD_PARTY hérite-t-elle de sa nature, ou la remplace-t-elle ?

**Décision : elle la REMPLACE. La nature est celle de la DERNIÈRE opération. Mais elle doit porter
la trace des natures d'entrée, dans un champ `natureBasis`.**

`intel_canonical_entities.riskClass` = `HIGH` sur 339 900 entités dont la `strongestSource` est
`scamsniffer` (un flux tiers de rang 2). Les deux autres réponses possibles sont fausses, et pour
des raisons opposées :

* *hériter de THIRD_PARTY* blanchirait notre calcul en fait d'autrui — c'est exactement le sens de
  faute que le discovery a mesuré sept fois ;
* *dire seulement INFERENCE* perdrait que le plancher de cette inférence est un flux de rang 2, et
  la rendrait indistinguable d'une inférence sur observation directe.

D'où la règle en deux temps : `nature = INFERENCE`, `natureBasis = {THIRD_PARTY_DATA}`. Pour
`riskClass`, `natureBasis` est déjà calculable sans rien ajouter : `strongestSource` existe.

**Sous-règle non négociable — la nature ne remonte jamais l'échelle.** Une INFERENCE ne devient
jamais une PRIMARY_OBSERVATION parce qu'on l'a recalculée ; une ESTIMATE ne devient jamais une
INFERENCE parce qu'on a affiné la méthode. Monotone, dans un seul sens. C'est l'invariant le plus
important de la spec, et il est testable (§4).

### Q4 — `documentationStatus` / `reviewStatus` / `visibility` : nature ou processus ?

**Décision : processus. Sans exception. Et un changement de processus ne change JAMAIS la nature.**

Les deux axes bougent déjà indépendamment en production, et les chiffres le montrent :
`documentationStatus='partial'` coexiste avec `reviewStatus='approved_public'` sur **175 lignes**
et avec `auto_draft` sur **104**. Une même affirmation, de même nature, à deux étapes de workflow.

Ce qui doit changer n'est pas le schéma mais la lecture : ces colonnes sont régulièrement utilisées
*comme si* elles disaient la nature — « c'est `documented`, donc c'est solide ». Un lien
`documentationStatus='documented'` dont l'adresse vaut `PENDING:SERIAL-12RUGS` est documenté **et**
sans ancrage on-chain. Les deux sont vrais, sur deux axes différents.

`visibility` mérite une mention à part : il porte un **troisième** état, `rejected`, sur 1 ligne,
qu'aucune liste blanche du dépôt n'énumère explicitement en dehors des requêtes de résolution. Rien
à changer côté nature ; à noter côté invariants.

### Q5 — Une ESTIMATE peut-elle être publiée sans sa méthode ?

**Décision : non. C'est la seule nature qui porte un compagnon OBLIGATOIRE, et c'est la seule
doctrine de cette spec qu'une contrainte de base de données peut tenir toute seule.**

```sql
CHECK ( nature <> 'ESTIMATE' OR "methodRef" IS NOT NULL )
```

Justification par les chiffres : `token_casefiles` porte `estimatedRetailHarmUsd = 482 000 000` à
côté de `claimedRaiseUsd = 1 500 000` — rapport 1 à 321, même type numérique, aucune méthode
attachée. La colonne `methodologyRef` **existe déjà** dans `KolCase` : la convention est dans la
maison, elle n'est simplement pas appliquée là où l'enjeu est le plus grand.

Une ESTIMATE sans méthode n'est pas une donnée faible, c'est une donnée **infalsifiable** : on ne
peut ni la vérifier ni la contester. Sur un produit dont la sortie peut être opposée à quelqu'un,
c'est la seule catégorie qui doit être bloquée à l'écriture plutôt que signalée à la lecture.

### Q6 — `claimType` est-il la cible, ou faut-il le remplacer ?

**Décision : ni l'un ni l'autre. On crée `DataNature` comme enum canonique, et les vocabulaires
existants deviennent des ENTRÉES MAPPÉES, pas des concurrents.**

Aucun des huit vocabulaires ne peut être promu tel quel, pour une raison unique : **ils mélangent
tous nature, méthode et source sur un seul axe.** `MmAttribMethod` met `ARKHAM` (un tiers),
`OSINT` (une méthode) et `INFERRED_CLUSTER` (une nature) côte à côte. Promouvoir l'un d'eux
figerait la confusion qu'on cherche à défaire.

Table de correspondance — c'est le cœur exécutable de la migration :

| Vocabulaire source | Valeur | → `DataNature` | Note |
|---|---|---|---|
| `KolWallet.claimType` | `source_attributed` (425) | `THIRD_PARTY_DATA` | |
| | `attributed` (5) | `THIRD_PARTY_DATA` | **synonyme à fusionner** |
| | `verified_onchain` (19) | `PRIMARY_OBSERVATION` | |
| | `onchain_confirmed` (3) | `PRIMARY_OBSERVATION` | **synonyme à fusionner** |
| | `analytical_estimate` (29) | `ESTIMATE` | `methodRef` requis → 29 lignes à documenter |
| | `self_posted` (1) | `THIRD_PARTY_DATA` | le sujet s'affirme lui-même |
| `KolCase.claimType` | `analytical_estimate` (10) / `source_attributed` (1) | `ESTIMATE` / `THIRD_PARTY_DATA` | `methodologyRef` déjà présent |
| `MmClaimType` | `FACT` (10) | dépend de la source → `THIRD_PARTY_DATA` si `MmSource`, sinon `PRIMARY_OBSERVATION` | **non mappable seul** |
| | `ALLEGATION` | `THIRD_PARTY_DATA` | |
| | `INFERENCE` | `INFERENCE` | |
| | `RESPONSE` | `THIRD_PARTY_DATA` | parole du sujet |
| `EvidenceItem.provenanceType` | `FIRST_PARTY_CAPTURE` (2) | `PRIMARY_OBSERVATION` | |
| | `MIGRATED_BACKFILL` (32) | **ne mappe pas** | décrit *comment la ligne est arrivée*, pas la nature. Axe différent — à renommer `ingestionMode`. |
| `MatchBasis` | `EXACT_*` / `INFERRED_LINKAGE`, `FUZZY_ALIAS` | `PRIMARY_OBSERVATION` / `INFERENCE` | |
| `GovernedStatusBasisEnum` | `external_authority_source` | `THIRD_PARTY_DATA` | |
| | `manual_internal_confirmation` | `EDITORIAL_ASSERTION` | |
| | `multi_source_corroboration`, `legacy_case_linkage` | `INFERENCE` | |

Deux enseignements de cette table, à retenir avant d'écrire une ligne de SQL :

1. **`MmClaimType.FACT` n'est pas mappable seul.** Un « fait » peut être une observation ou un
   relais de tiers ; il faut joindre `MmSource`. Toute migration qui mapperait `FACT` vers une
   nature unique se tromperait sur une partie des lignes. C'est le cas type qui justifie une
   migration **par table**, jamais un `UPDATE` global.
2. **`MIGRATED_BACKFILL` révèle un axe manquant.** Le seul champ du dépôt qui nomme une provenance
   mélange déjà « d'où vient la preuve » et « comment la ligne est entrée en base ». Le second
   n'est pas une nature ; il lui faut son propre champ.

---

## 3. Le contrat technique

### 3.1 L'enum

```sql
CREATE TYPE "DataNature" AS ENUM (
  'PRIMARY_OBSERVATION',
  'THIRD_PARTY_DATA',
  'INFERENCE',
  'ESTIMATE',
  'EDITORIAL_ASSERTION',
  'UNCLASSIFIED'          -- fail-closed : jamais publiable, jamais un défaut choisi
);
```

`UNCLASSIFIED` n'est pas une sixième nature : c'est **l'aveu explicite qu'on ne sait pas**, et il
est bloquant à la frontière publique. Sans lui, toute donnée non classée hériterait silencieusement
d'un défaut — et un défaut silencieux est précisément le mécanisme des sept sites de mélange.

### 3.2 Les champs compagnons

| Champ | Type | Obligatoire | Rôle |
|---|---|---|---|
| `nature` | `"DataNature"` | oui (régimes LIGNE et CHAMP) | la nature de l'affirmation |
| `<champ>Nature` | `"DataNature"` | régime CHAMP | nature d'un champ gouverné |
| `natureBasis` | `"DataNature"[]` | si `nature='INFERENCE'` | natures des entrées (Q3) |
| `methodRef` | `text` | **si `nature='ESTIMATE'`** (CHECK) | référence de méthode (Q5) |
| `ingestionMode` | `text` | non | comment la ligne est entrée (ex-`MIGRATED_BACKFILL`) |

### 3.3 Le registre — la pièce qui évite 1,55 million d'`UPDATE`

`src/lib/data-nature/registry.ts`, **code, pas base** :

```ts
export const NATURE_REGISTRY: Record<TableName, TableNatureDecl> = {
  intel_source_observations: { regime: "DECLARED", nature: "THIRD_PARTY_DATA" },
  intel_canonical_entities:  { regime: "DECLARED", nature: "INFERENCE",
                               basis: ["THIRD_PARTY_DATA"] },
  EvidenceSnapshot:          { regime: "DECLARED", nature: "PRIMARY_OBSERVATION" },
  AddressLabel:              { regime: "DECLARED_PREDICATE",
                               nature: (r) => r.sourceName === "INTERLIGENS"
                                 ? "EDITORIAL_ASSERTION" : "THIRD_PARTY_DATA" },
  DomainLabel:               { regime: "DECLARED_PREDICATE",
                               nature: (r) => r.sourceName === "INTERLIGENS"
                                 ? "EDITORIAL_ASSERTION" : "THIRD_PARTY_DATA" },
  KolTokenLink:              { regime: "FIELD",
                               rowDefault: (r) => r.sourceType === "watcher"
                                 ? "PRIMARY_OBSERVATION" : "EDITORIAL_ASSERTION",
                               fields: { canonicalMint: "INFERENCE",
                                         note: "EDITORIAL_ASSERTION",
                                         contractAddress: "PRIMARY_OBSERVATION" } },
  // …
};
```

Quatre tables — `DomainLabel` 631 391, `intel_source_observations` 352 840,
`intel_canonical_entities` 350 012, `AddressLabel` 217 813 — représentent **1 552 056 lignes**, soit
l'écrasante majorité du volume. **Les quatre sont couvertes sans une seule écriture** : deux par le
régime DÉCLARÉ (mono-nature), deux par DÉCLARÉ + PRÉDICAT, `sourceName` séparant déjà les 4 lignes
`INTERLIGENS` des 849 200 autres. C'est ce qui rend cette fondation faisable en additif.

---

## 4. Les invariants, et comment on les tient

Un invariant qui n'est pas testé est une intention. Cinq tests, par ordre d'importance :

| # | Invariant | Tenu par |
|---|---|---|
| I1 | La nature ne remonte jamais l'échelle (Q3) | test unitaire sur la fonction de transition |
| I2 | `ESTIMATE ⇒ methodRef IS NOT NULL` | **contrainte `CHECK` en base** |
| I3 | Une sortie publique ne contient jamais `UNCLASSIFIED` | test d'intégration sur les sérialiseurs |
| I4 | Un changement de `visibility` / `reviewStatus` ne change pas `nature` (Q4) | test sur les routes d'écriture |
| I5 | Toute table nouvelle est dans le registre, sinon `UNCLASSIFIED` | test qui compare `information_schema` au registre |

I5 est celui qui empêche la fondation de pourrir : sans lui, la 179ᵉ table naîtra non classée et
personne ne le saura. Il est peu coûteux — une requête sur `information_schema.tables` et un `diff`
avec les clés du registre.

I2 est le seul qui vive en base, et c'est justifié : c'est la seule doctrine dont la violation est
détectable sans contexte applicatif.

---

## 5. Plan de migration — six étapes, aucune exécutée ici

**Contraintes de la maison, respectées par construction :** schema **toujours additif, jamais
destructif** ; `prisma migrate` est verrouillé (A9, `P1012` sur `getConfig`) donc **tout le DDL
passe par le Neon SQL Editor** ; `prisma/schema.prod.prisma` est recalé après coup, en additif ;
les chemins gelés par le guard demandent une fenêtre d'exemption avant d'être touchés.

| Étape | Contenu | DDL | Lignes écrites | Réversible |
|---|---|---|---|---|
| **S0** | **Ratification.** Trancher Q1–Q6, figer les 6 valeurs de l'enum, valider la table de correspondance §Q6 | aucun | 0 | — |
| **S1** | **Le registre.** `registry.ts` + test I5. Les 3 grosses tables mono-nature sont couvertes | aucun | 0 | suppression du fichier |
| **S2** | **La frontière de sortie.** Les sérialiseurs publics émettent la nature *depuis le registre* | aucun | 0 | drapeau de sortie |
| **S3** | **L'enum + les champs gouvernés.** `CREATE TYPE`, puis `ADD COLUMN` sur les **6 petites tables à fort enjeu** | `CREATE TYPE` + `ADD COLUMN` | **~2 900** | `DROP COLUMN` (additif) |
| **S4** | **Convergence des vocabulaires.** Fusion des 2 paires de synonymes (**8 lignes**), vues de correspondance | vues | 8 | `UPDATE` inverse |
| **S5** | **La contrainte ESTIMATE.** `methodRef` + `CHECK` sur les 2 tables porteuses | `ADD COLUMN` + `CHECK` | 39 à documenter | `DROP CONSTRAINT` |
| **S6** | **Les grosses tables — en dernier, et seulement si nécessaire.** Elles restent DÉCLARÉES (± prédicat) tant qu'aucune exception **non séparable par un prédicat** n'apparaît | conditionnel | 0 par défaut | — |

### Détail des étapes qui touchent la base

**S3 — périmètre exact.** `KolTokenLink` (292), `TokenPriceTracker` (340), `EvidenceItem` (1 104),
`EvidenceSnapshot` (1 159), `KolTokenInvolvement` (15), `token_casefiles` (1) — **2 911 lignes**.
Choisies parce qu'elles concentrent M3, M4, M5, M6, portent le plus d'enjeu probatoire, et sont
assez petites pour un backfill vérifiable ligne à ligne. Backfill **déterministe depuis le
registre**, jamais un `UPDATE` global : la leçon de `MmClaimType.FACT` (§Q6) est qu'une même valeur
source peut mapper vers deux natures selon la jointure.

**S4 — les 8 lignes.** `attributed` → `source_attributed` (5), `onchain_confirmed` →
`verified_onchain` (3). Le plus petit `UPDATE` du plan, et le seul qui touche de la donnée
existante. À faire *après* S3 pour que la nature soit déjà posée et serve de témoin.

**S5 — les 39 lignes à documenter.** `KolWallet.claimType='analytical_estimate'` (29) et
`KolCase` (10) deviennent `ESTIMATE` et exigent donc un `methodRef`. **C'est du travail éditorial,
pas de la migration** : quelqu'un doit écrire la méthode de 39 estimations, ou les déclasser. La
contrainte `CHECK` ne peut être posée qu'une fois ce travail fait — c'est le vrai chemin critique
du plan, et il ne se code pas.

### Ordre : pourquoi la sortie AVANT le schéma

S2 précède S3 délibérément. Le dégât mesuré par le discovery se produit **à la lecture** — un
consommateur qui reçoit une inférence et la lit comme une observation. Étiqueter les sorties depuis
le registre traite le symptôme dès la première semaine, sans DDL, sans backfill, et **sans risque**.
Le schéma vient ensuite consolider ce que le code sait déjà.

### Ce qui ferait échouer ce plan

* **Ratifier S0 mollement.** Q1 et Q3 sont structurantes ; les laisser « à voir » produirait un
  registre incohérent que S3 figerait en base.
* **Traiter S5 comme de la technique.** Écrire la méthode de 39 estimations est le seul poste qui
  demande un humain et du temps. Si personne ne le prend, la contrainte ne sera jamais posée et
  Q5 restera une intention.
* **Céder sur `UNCLASSIFIED`.** À la première sortie bloquée, la tentation sera de lui donner un
  défaut. Ce serait recréer exactement le mécanisme que la fondation existe pour supprimer.
* **Confondre ce plan avec l'unification des 27 colonnes `confidence*`.** C'est un autre chantier ;
  le mélanger triplerait la surface et diluerait la décision.

---

## 6. Ce que cette spec ne tranche pas

* **L'unification de la confiance** (27 colonnes, 7 formes) — hors périmètre, et volontairement.
  Elle devient plus simple après, pas avant.
* **La classification des ~150 tables** non citées ici. Le discovery a recensé, pas classé, et
  classer les 178 serait l'archéologie explicitement écartée. Le régime `UNCLASSIFIED` +
  l'invariant I5 rendent ce retard **visible et non dangereux** : une table non classée ne peut
  rien publier.
* **`SOURCE_AUTHORITY` du résolveur V3** (§Q2, point 3) : un classement de natures qui mélange les
  axes. À reprendre une fois `DataNature` ratifié — pas avant, sous peine de figer deux fois.
* **Le sort de `MmClaimType`.** Enum typé, proche de la cible, mais non mappable seul. Le garder
  comme vocabulaire local mappé, ou le retirer, est une décision à prendre avec les propriétaires
  du module MM.

---

## Data Nature — DISCOVERY / PREP

**DISCOVERY.** Le balayage des types énumérés a corrigé le discovery de la veille : le produit ne
porte pas deux vocabulaires de nature mais **huit**, dont un enum typé (`MmClaimType`) très proche
de la cible. Le diagnostic change avec : le problème n'est pas l'absence d'étiquette, c'est que
**nature, méthode et source sont écrasées sur un seul axe** dans chacun des huit.

**PREP.** Cette spec est prête à être ratifiée. Le chiffre qui décide de sa faisabilité :
**2 911 lignes** à écrire en S3, contre **1 552 056** couvertes sans écriture par les régimes
DÉCLARÉ et DÉCLARÉ + PRÉDICAT. La fondation tient parce qu'un flux d'ingestion produit une seule
nature à la fois, et que là où il en produit deux, une colonne existante les sépare déjà.

Rien n'a été écrit, rien n'a été mergé, aucune migration n'a été exécutée. Toutes les requêtes de
ce rapport sont rejouables en lecture seule.
