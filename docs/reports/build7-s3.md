# BUILD 7 — SIMILARITY V2 · S3

Branche `feat/cc-offline-149-similarity-v2-s0-s2`, depuis `main = f31c9e6`.
Méthode **`similarity/compare@v1`**, gelée le 2026-09-05,
sha `4395fddbd6336a240278c3214938a48a1697a610bd3b4d2e306550d4e3155d94`.

> **L'ordre compte plus que le gel lui-même.** La méthode a été arrêtée AVANT
> d'observer la moindre comparaison. Une méthode ajustée après coup ne
> mesurerait plus que son ajustement.

**Rejouable hors ligne :** `npx tsx scripts/similarity/s3-run.ts`.
**Verrouillé :** `src/lib/similarity/__tests__/s3-run.test.ts` (27 tests).

---

## G1 — L'identité BOTIFY, tranchée en lecture seule

### Les deux chaînes, et le piège

```
BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb   44 car.   ← le mint
BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb    43 car.   ← une clé de route
```

**Les deux se décodent en EXACTEMENT 32 octets en base58** (vérifié hors ligne).
La clé synthétique est donc structurellement une clé publique Ed25519 valide :
**aucune vérification de forme ne pouvait la distinguer.** Seule une autorité
pouvait trancher — c'est pourquoi la garde livrée est une TABLE, pas un
validateur.

### Ce qui tranche — cinq autorités concordantes

| autorité | ce qu'on y lit |
|---|---|
| `src/lib/kol/proceeds.ts › CA_MAP` | `BOTIFY`, `BOTIFY-MAIN` et `SERIAL-12RUGS` pointent tous trois sur le mint « avec i » |
| `v3/__fixtures__/dexscreener.mint.BOTIFY.json` | `baseToken.address` de la paire Raydium réelle `BourCfkdGsr55XAVzDeU6tci7twRTiCGRvCLioENnBBX` |
| `v3/__tests__/doctrinalCorpus.ts › LIVE` | déclaré **« contrats réels »** par le corpus doctrinal du Resolver |
| `scripts/osint/out-botify-david-trace.json` | trace on-chain réelle : **154 signatures inspectées**, 11 mouvements, txHash opposables |
| **ep-square-band, lecture seule 2026-09-05** | `ShillEvent` **5 lignes**, `KolTokenLink` **5 lignes** — toutes sur « avec i » |

### La mesure qui clôt le débat

| table | lignes sur la clé « sans i » |
|---|---|
| `ExitEvent` | **0** |
| `ShillEvent` | **0** |
| `KolTokenLink` | **0** |

**La clé « sans i » n'est l'identité de rien.** C'est une clé de LOOKUP, et elle
est légitime là où elle sert : `src/lib/demo/presets.ts` (scénario « red »),
`MINT_TO_PRESET` de `/api/casefile/public` et `/api/casefile/pdf`,
`MINT_TO_CASEFILE_PRESET`, `src/data/cases/botify.json › case_meta.mint`, et
`exports/BOTIFY_EVIDENCE_TABLE.json` — dont les `evidenceUrl` pointent vers
solscan et dexscreener **avec cette clé**, tandis que ses colonnes `wallets`,
`amountUsd` et `txHashes` sont **vides**. C'est une table de démonstration, pas
une table de preuves.

> ⚠️ **Piège de documentation trouvé.** `src/lib/casefile/presets.ts:146-148`
> écrit de la clé de route : *« the route key is the canonical one »*. C'est vrai
> **dans son périmètre** (le routage casefile) et **faux** comme affirmation
> d'identité on-chain. Lu hors contexte, ce commentaire envoie droit sur la clé
> synthétique. Il n'est pas modifié ici — il est **neutralisé** par la garde.

> ⚠️ **Deuxième divergence interne.** `src/lib/casefile/presets.ts ›
> buildBotifyInput().case_meta.mint` porte le mint « avec i », alors que
> `src/data/cases/botify.json › case_meta.mint` porte la clé « sans i ». Deux
> sources de casefile en désaccord sur l'identité du même dossier.

### La garantie livrée

`src/lib/similarity/subject.ts` — `assertCanonicalMint()` **lève**
(`SyntheticMintError`) sur la clé de route et sur tout mint non déclaré. Chaque
sujet cite ses autorités dans le code. Toute construction de sujet S3 passe par
là : **S3 ne peut pas interpréter une clé synthétique comme un mint canonique.**

**G1 : RÉSOLU en lecture seule. Aucun appel Helius, aucune discovery.**

---

## G2 — Le gel

`content/methodologies/similarity/v1.md` — `status: FROZEN`, `effectiveFrom:
2026-09-05`, **17 features**, 4 verdicts, 9 motifs, 9 invariants, aucun seuil,
aucun score, aucun poids.

> Chemin : la convention du dépôt est `content/methodologies/<id>/v1.md` (quatre
> artefacts existants la suivent) ; le pack écrivait `…/similarity/compare/v1.md`.
> Le fichier est posé **à la convention**, `compare` étant l'identifiant de
> COMPOSANT à l'intérieur — c'est lui que cite `similarity/compare@v1`.

| vérification | résultat |
|---|---|
| `contentSha256` déclaré = sha du corps gelé | ✅ `4395fddb…3155d94` |
| miroir TypeScript = `.md` **octet pour octet** | ✅ dans les deux sens |
| `resolveMethodRef("similarity/compare@v1")` | ✅ `componentId: compare`, `version: v1` |
| les 17 clés du registre citées dans le corps gelé | ✅ |
| les 4 verdicts et 9 motifs cités dans le corps gelé | ✅ |

### La bascule du tripwire

S2 portait un test qui affirmait **« le ref NE résout PAS »**, et une réserve
`METHODOLOGY ARTIFACT NOT FROZEN` sur chaque résultat. Le tripwire a rougi au
gel — comme prévu — et a forcé, **en un seul geste** : la réécriture du test
(qui exige désormais résolution + sha concordant + identité octet pour octet) et
le retrait de la réserve, remplacée par `METHOD IS FROZEN AND CITABLE`. Une
réserve devenue fausse serait du bruit, et un bruit ne protège personne.

### Une correction, faite avant tout résultat

Le rapport S0→S2 annonçait « 16 features » ; le registre en déclare **17**
(`COORDINATED_EXIT` en porte six). L'erreur était dans le **comptage du
rapport**, jamais dans le code — le tableau listait bien les 17. Découverte par
le test de gel qui compare le corps gelé au registre, corrigée **avant** le run,
et désormais fixée (`toHaveLength(17)`). Un erratum est posé sur `build7-s0-s2.md`.

---

## G3 — Le run VINE ↔ BOTIFY

**Corpus** : ep-square-band, lecture seule, 2026-09-05, `SELECT` uniquement.
Recopié verbatim dans `src/lib/similarity/__fixtures__/s3-corpus.ts` pour que le
run soit rejouable hors ligne — un run qui n'existerait que branché sur la base
ne serait pas un résultat, mais un instantané que personne ne pourrait
contredire six mois plus tard.

| | VINE (`CASE-2025-VINE-001`) | BOTIFY (`CASE-2024-BOTIFY-001`) |
|---|---|---|
| `ExitEvent` | **458** (453 SELL, 5 transferts), 15 sujets | **0** |
| `CoExitQualification` | **6** groupes, fenêtre 60 s | **0** |
| `FundingEdge` | **12** | **0** |
| `ShillEvent` | **0** | **5** |
| `KolTokenLink` | 3, sur le littéral `PENDING:VINE` | **5** |

### La politique d'extraction — déclarée avant le run

Le gel gouverne la **comparaison** ; l'extraction gouverne **ce qu'on lui
donne**. La frontière est nette, et les quatre règles sont écrites dans
`__fixtures__/s3-extract.ts` :

| | règle | pourquoi |
|---|---|---|
| **P1** | une ligne source `rowNature` NULL n'est pas une observation démontrée | UNCLASSIFIED ne publie rien (I3) ; l'admettre la ferait entrer sous la nature du REGISTRE, que la ligne ne porte pas |
| **P2** | une ligne `EDITORIAL_ASSERTION` n'alimente aucune feature déclarée `PRIMARY_OBSERVATION` ou `INFERENCE` | c'est I1, appliquée une étape plus tôt — INV-6 ne compare la nature qu'au registre, pas à la source |
| **P3** | une dimension « par groupe » n'a pas de valeur « par sujet » | le registre dit « dans le groupe » ; une somme ou une moyenne sur 6 groupes fabriquerait une grandeur que rien n'a mesurée. Les catégorielles reprennent la règle amont : **unanimité** |
| **P4** | un sujet n'existe que sous son mint canonique | G1 |

### Résultat par feature

| feature | VINE | BOTIFY | verdict | motif | plancher |
|---|---|---|---|---|---|
| `identity.token_resolution_status` | _MISSING_ | _NOT_OBSERVED_ | NOT_COMPARABLE | `SIDE_NOT_OBSERVABLE` | oui |
| `identity.chain_demonstrated` | `solana` | `solana` | **MATCH** | `EQUAL_VALUE` | — |
| `temporal.anchor_provenance` | _MISSING_ | _NOT_OBSERVED_ | NOT_COMPARABLE | `SIDE_NOT_OBSERVABLE` | oui |
| `temporal.exit_cluster_span_seconds` | _NOT_MEASURABLE_ | _MISSING_ | NOT_COMPARABLE | `SIDE_NOT_OBSERVABLE` | — |
| `temporal.exit_cluster_min_gap_seconds` | _NOT_MEASURABLE_ | _MISSING_ | NOT_COMPARABLE | `SIDE_NOT_OBSERVABLE` | — |
| `funding.shared_funder_addresses` | 4 adresses | _MISSING_ | NOT_COMPARABLE | `SIDE_NOT_OBSERVABLE` | oui |
| `funding.relationship_categories` | `DUST` `PRIVATE_SHARED_FUNDER` `SELF_OR_KNOWN_ACTOR` | _MISSING_ | NOT_COMPARABLE | `SIDE_NOT_OBSERVABLE` | oui |
| `funding.external_funder_count` | 3 funders | _MISSING_ | NOT_COMPARABLE | `SIDE_NOT_OBSERVABLE` | oui |
| `shill.promotion_qualification` | _MISSING_ | _MISSING_ | NOT_COMPARABLE | `SIDE_NOT_OBSERVABLE` | — |
| `shill.kol_handles` | _MISSING_ | _NOT_OBSERVED_ | NOT_COMPARABLE | `SIDE_NOT_OBSERVABLE` | oui |
| `exit.cluster_category` | `NARROW_WINDOW_CLUSTER` | _MISSING_ | NOT_COMPARABLE | `SIDE_NOT_OBSERVABLE` | — |
| `exit.demonstrated_venue` | _NOT_OBSERVED_ | _MISSING_ | NOT_COMPARABLE | `SIDE_NOT_OBSERVABLE` | — |
| `exit.demonstrated_destination` | _NOT_OBSERVED_ | _MISSING_ | NOT_COMPARABLE | `SIDE_NOT_OBSERVABLE` | — |
| `exit.distinct_subjects` | _NOT_MEASURABLE_ | _MISSING_ | NOT_COMPARABLE | `SIDE_NOT_OBSERVABLE` | — |
| `exit.composition_profile` | _NOT_OBSERVED_ | _MISSING_ | NOT_COMPARABLE | `SIDE_NOT_OBSERVABLE` | — |
| `exit.materiality` | _NOT_MEASURABLE_ | _MISSING_ | NOT_COMPARABLE | `SIDE_NOT_OBSERVABLE` | — |
| `preshill.front_run_wallets` | _MISSING_ | _MISSING_ | NOT_COMPARABLE | `SIDE_NOT_OBSERVABLE` | — |

### Comptes agrégés — par état de comparateur uniquement

```
Verdicts   MATCH=1   PARTIAL_MATCH=0   DIFFERENT=0   NOT_COMPARABLE=16
Motifs     EQUAL_VALUE=1   SIDE_NOT_OBSERVABLE=16
États VINE     OBSERVED=5   NOT_OBSERVED=3   NOT_MEASURABLE=4   MISSING=5
États BOTIFY   OBSERVED=1   NOT_OBSERVED=3   NOT_MEASURABLE=0   MISSING=13
```

**Aucun pourcentage n'est dérivé de ces comptes, et aucun ne doit l'être.** Ce
sont des décomptes d'états de comparateur, pas les termes d'un ratio : le
dénominateur serait le nombre de features déclarées, ce qui ferait varier la
« similarité » avec la longueur du registre.

### Base de preuve, DataNature et couverture

- **VINE, côté observé** : `funding.shared_funder_addresses` cite les
  **signatures de transaction** des 12 arêtes ; `exit.cluster_category` cite les
  **6 `groupKey`** et une signature par groupe. Natures : `PRIMARY_OBSERVATION`
  pour les bailleurs, `INFERENCE` pour les catégories et la caractérisation —
  telles que le REGISTRE les déclare, jamais telles qu'un adaptateur les
  proposerait.
- **Couverture financement : CENSURÉE, et c'est structurel.**
  `funding-graph/snapshot@v1` le dit dans son en-tête : une collecte cadrée sur
  un mint ne voit que les transferts SOL qui accompagnent les transactions de ce
  token. **12 arêtes ne sont pas « le financement de VINE » : elles en sont un
  plancher.** Les quatre features de financement portent donc `resultIsFloor`.
- **Couverture co-sortie : COMPLÈTE, telle que la table la porte** —
  `coverageAnyIncomplete = false` sur les 6 lignes.
- **BOTIFY** : une seule feature observée, et sa couverture est complète parce
  qu'elle ne dépend d'aucune collecte (voir ci-dessous).

### Similarités significatives

**Aucune.** La seule est `identity.chain_demonstrated` = `solana` des deux
côtés — voir « features trompeuses ».

### Différences significatives

**Aucune, et c'est le résultat correct.** BOTIFY n'a ni sortie, ni financement,
ni promotion exploitable dans les tables. Rendre cela comme « les deux affaires
diffèrent » convertirait une absence de collecte en fait sur le monde. Le
comparateur n'affirme **aucun** `DIFFERENT` sur ce couple.

### Refus de comparer — corrects, un par un

Les 16 refus se répartissent en trois causes réelles, et le motif **nomme les
deux états** dans chacun :

1. **BOTIFY n'a pas la donnée** (13 features `MISSING`) — aucune ligne
   `ExitEvent`, `FundingEdge` ou occasion n'existe pour ce mint. Correct.
2. **VINE n'a pas la donnée sociale** (5 features `MISSING`) — 0 `ShillEvent`,
   et les 3 `KolTokenLink` portent le littéral **`PENDING:VINE`** avec
   `contractAddressNature = UNCLASSIFIED`. Ce n'est pas un mint : c'est un
   placeholder. Correct.
3. **La donnée existe mais n'est pas admissible** (3 features BOTIFY
   `NOT_OBSERVED`) — voir la section suivante, c'est le résultat le plus
   instructif du run.

### Ce que BOTIFY a, et pourquoi ça n'entre pas

| feature | ce qui existe | pourquoi refusé |
|---|---|---|
| `identity.token_resolution_status` | 5 `ShillEvent`, tous `resolved_direct` | `rowNature` **NULL** (UNCLASSIFIED) et `sourcePostCandidateId` **NULL** sur 5/5 → **P1** |
| `temporal.anchor_provenance` | 5 lignes, `timestampSource = date_only` | **`date_only` est absent du vocabulaire fermé de @v1** ; `tweetId` sont des chaînes construites (`malxbt_botify_20250111`), pas des snowflakes ; horodatages à minuit pile |
| `shill.kol_handles` | 5 `KolTokenLink`, 5 handles | `rowNature = EDITORIAL_ASSERTION` sur 5/5, alors que le registre déclare la feature **`PRIMARY_OBSERVATION`** → **P2**, la nature monterait d'un cran |

---

## CONTRÔLE intra-VINE — le comparateur est prudent, pas mort

Un run qui ne rendrait QUE des refus ne distinguerait pas un comparateur prudent
d'un comparateur mort. Ce contrôle compare **deux groupes de co-sortie réels et
persistés**, au niveau où le registre dit que les dimensions ont un sens : le
GROUPE. **Ce n'est pas un résultat VINE↔BOTIFY et ne doit jamais être lu comme
tel.**

### Groupe `@1737595696` (9 sujets) ↔ groupe `@1737597101` (5 sujets)

```
Verdicts   MATCH=5   PARTIAL_MATCH=1   DIFFERENT=0   NOT_COMPARABLE=11
Motifs     EQUAL_VALUE=4  IDENTICAL_SET=1  SET_OVERLAP_PARTIAL=1
           ORDINAL_REQUIRES_UNDECLARED_THRESHOLD=4  SIDE_NOT_OBSERVABLE=7
```

- **PARTIAL_MATCH** sur `funding.shared_funder_addresses` — recouvrement
  d'ADRESSES réelles, publié en trois listes :
  `shared = [GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE]`,
  `onlyLeft = [2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm]`, `onlyRight = []`.
  Sous couverture bornée, **le positif survit — comme plancher.**
- **MATCH** sur `exit.cluster_category`, `exit.demonstrated_venue` (`RAYDIUM`),
  `exit.demonstrated_destination` (`5Q544fKrFo…`), `exit.composition_profile`
  (`SELL_ONLY`), `funding.relationship_categories` (`{PRIVATE_SHARED_FUNDER}`).
- **NOT_COMPARABLE sur les 4 grandeurs**, dont **191 s contre 49 s** et
  **9 sujets contre 5** : les valeurs sont transportées, jamais jugées.

### Groupe `@1737595696` ↔ groupe `@1737607946` (2 sujets)

```
Verdicts   MATCH=1   PARTIAL_MATCH=0   DIFFERENT=1   NOT_COMPARABLE=15
```

**La seule DIFFÉRENCE affirmée de tout ce build** :
`exit.composition_profile` = `SELL_ONLY` contre `MIXED`, sous **couverture
complète des deux côtés** (`resultIsFloor = false`). Un transfert DÉPLACE, une
vente CÈDE — la différence est réelle, et le comparateur ne l'affirme que
parce que rien n'était censuré.

**Les quatre verdicts sont donc exercés sur données réelles et persistées.**

---

## Features trompeuses ou problématiques

### 1. `identity.chain_demonstrated` — un MATCH sans pouvoir discriminant

Sur un produit Solana-only, cette feature **ne peut rendre que `MATCH`**. Le
seul match du run VINE↔BOTIFY est celui-là. Il est **vrai** et **vide** : deux
tokens Solana partagent leur chaîne, comme des dizaines de milliers d'autres.
Une lecture pressée la comptera comme « 1 similarité trouvée ». **À écarter ou
à marquer explicitement sans pouvoir discriminant en @v2.**

### 2. `exit.demonstrated_destination` — le risque le plus sérieux du contrat

Le contrôle intra-VINE rend `MATCH` sur
`5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1`, destination unanime de trois
groupes. **Cette adresse n'a AUCUNE étiquette auditable dans le produit** : elle
n'est ni dans `KNOWN_ROUTERS`, ni dans `KNOWN_INFRA`. Or les trois groupes qui
la nomment sont exactement ceux dont le venue est `RAYDIUM` — la corrélation
venue/destination est parfaite sur ce corpus, ce qui est le comportement attendu
d'une **infrastructure d'AMM**, pas d'un destinataire choisi.

> **La même adresse apparaît dans `scripts/osint/out-botify-david-trace.json`**,
> comme contrepartie d'un mouvement BOTIFY. Une lecture naïve y verrait « la
> même destination dans les deux affaires ». Si cette adresse est de
> l'infrastructure, la co-occurrence ne vaut **rien**.

`qualifyFundingRelationship` sait déjà écarter un `KNOWN_EXCHANGE` sur étiquette
auditable ; **`exit.demonstrated_destination` n'a aucun équivalent.** C'est la
lacune la plus dangereuse relevée par S3 : elle produit un `MATCH` fort sur ce
qui pourrait être un tuyau partagé par tout le marché. **Aucune étiquette n'est
posée ici** — poser une étiquette non sourçable serait précisément la faute que
la doctrine interdit.

### 3. `funding.shared_funder_addresses` — juste, mais à lire avec sa jumelle

Le run rend 4 bailleurs pour VINE. Leurs catégories les séparent :
`SELF_OR_KNOWN_ACTOR` (un sujet qui en finance d'autres),
`DUST` (20 000 lamports, sous le plancher d'opération de 895 880),
`PRIVATE_SHARED_FUNDER` (×2). **Lire l'ensemble d'adresses sans
`funding.relationship_categories` ferait passer un transfert de poussière pour
un financement.** Les deux features doivent voyager ensemble.

### 4. `exit.materiality` — la feature qui n'a jamais rien mesuré

`NOT_MEASURABLE` sur **6 groupes sur 6**, et sur les deux sujets. Elle a
parfaitement joué son rôle — deux `NOT_MEASURABLE` ne se ressemblent pas — mais
elle n'a **jamais produit une valeur** dans toute l'histoire du produit. À
conserver comme démonstrateur d'invariant, à ne pas compter comme feature
utilisable.

---

## Features réellement manquantes

| feature | état réel | ce qui manque |
|---|---|---|
| `shill.promotion_qualification` | `MISSING` des **deux** côtés | `PromotionQualification` n'est persistée nulle part : `ShillEvent.natureBasis` est NULL sur les 5 lignes BOTIFY. Le prédicat tourne à l'écriture et son verdict est perdu. |
| `preshill.front_run_wallets` | `MISSING` des **deux** côtés | 2 169 `ShillBuyerObservation` existent, mais aucune occasion n'est rattachée à VINE (0 `ShillEvent`) ni exploitable pour BOTIFY (P1). Le moteur expérimental n'a rien à mordre sur ces deux dossiers. |
| `funding.*` pour BOTIFY | `MISSING` | 12 `FundingEdge` en base, **toutes** `sourceContext = CASE-2025-VINE-001`. Aucune collecte de financement n'a jamais tourné sur BOTIFY. |
| `exit.*` pour BOTIFY | `MISSING` | 458 `ExitEvent`, **toutes** sur le mint VINE. Aucune collecte de sortie n'a jamais tourné sur BOTIFY. |
| `FundingRelationship` (table) | absente en base | annoncée dans le rapport S0→S2 ; les catégories sont recalculées à la volée par le run, et **la couverture a dû être déclarée**, pas lue. |

---

## Contradictions aux hypothèses S2

### C1 — Le vocabulaire fermé de `temporal.anchor_provenance` est incomplet

S2 supposait `{snowflake, source_timestamp}`. Le corpus porte
**`date_only`** sur 5 lignes sur 5. Le contrat **ne plie pas** : construire
l'observation lève `MalformedObservationError` — c'est la bonne réaction, et
c'est prouvé par un test. **@v1 n'est pas ajusté après coup** ; la lacune est
consignée pour @v2.

### C2 — Il manque un sixième état : « trouvé, mais inadmissible »

Les cinq états couvrent l'absence sous ses quatre formes. Ils ne couvrent PAS
« la donnée source existe, et elle n'est pas admissible » — le cas des 5
`ShillEvent` UNCLASSIFIED et des 5 `KolTokenLink` EDITORIAL_ASSERTION. Le run a
dû les ranger sous `NOT_OBSERVED` **en portant le motif exact**, faute de mieux.
Le verdict n'en est pas affecté (les cinq états rendent tous
`NOT_COMPARABLE`), mais **la lisibilité, si**. Candidat @v2 : `INADMISSIBLE`.

### C3 — Le contrat n'a pas de règle d'agrégation « groupe → sujet »

Les features `exit.*` et `temporal.exit_*` sont définies **par groupe** ; VINE
en a six. @v1 ne dit rien du niveau sujet. Le run a choisi la lecture la plus
conservatrice — **unanimité** pour les catégorielles (la règle amont
`unanimous`), **`NOT_MEASURABLE`** pour les grandeurs — et l'a déclarée avant de
regarder. Conséquence mesurée : **`RAYDIUM` et `5Q544fKrFo…`, démontrés par 3
groupes sur 6, disparaissent au niveau sujet.** Une information réelle est
perdue par une règle que personne n'a ratifiée. **C'est la décision méthodo la
plus lourde à arbitrer avant @v2.**

### C4 — Le registre déclare une nature que le corpus ne porte pas

`shill.kol_handles` est déclarée `PRIMARY_OBSERVATION`. La **seule** donnée de
handles que le produit possède pour ces deux dossiers est
`EDITORIAL_ASSERTION` (5/5) ou UNCLASSIFIED (5/5). La feature est **inutilisable
sur ce corpus**, non par manque de données, mais par désaccord de nature. S2
avait supposé une source `occasions.ts` qui n'alimente aucune table.

### C5 — Aucune contradiction sémantique du comparateur gelé

Les 51 comparaisons (17 × 3 runs) ont été relues une par une. **Aucun verdict
n'est sémantiquement faux.** Les invariants ont tenu, et la vérification de
mutation reste verte après le gel : les 9 gardes portent toujours, chacune sur
son seul bloc.

---

## Attestation

- **Lecture seule sur ep-square-band** : `SELECT` uniquement, sur `ExitEvent`,
  `CoExitQualification`, `FundingEdge`, `ShillEvent`, `KolTokenLink` et
  `information_schema`. **0 write, 0 DDL, 0 migration.** La sonde a été
  supprimée après usage ; le corpus est recopié dans un fixture versionné.
- **0 appel Helius, 0 appel réseau, 0 discovery.** Aucune identité n'a été
  « corrigée » par supposition visuelle.
- **0 persistance du résultat** : le run vit en mémoire et dans un test.
- **0 score, 0 pourcentage, 0 seuil, 0 embedding, 0 LLM.** `assertNoAggregateScore`
  balaie récursivement chaque sortie.
- **@v1 n'a pas été ajusté après le run.** Les trois lacunes trouvées (C1, C2,
  C3) sont consignées pour @v2 et **non appliquées**.
- **0 chemin gelé touché.** Ajouts : `src/lib/similarity/**`,
  `content/methodologies/similarity/v1.md`, `scripts/similarity/s3-run.ts`,
  `docs/reports/build7-s3.md`. Modifications : `src/lib/methodology/artifact.ts`
  et `registry.ts` (enregistrement de l'artefact), erratum sur
  `docs/reports/build7-s0-s2.md`. `guard-offline` vert.
- **Suite complète : 367 fichiers, 4 567 tests verts**, 2 skipped. `tsc` 0 erreur,
  `lint:ci` 0 erreur, `mutation-check` 9/9.

**Conditions de MASTER STOP : aucune atteinte.** L'identité canonique est
résolue et gardée ; le comparateur gelé ne rend aucun résultat sémantiquement
faux ; aucune preuve source ne contredit une prémisse ratifiée. Les décisions
méthodo découvertes (C1, C2, C3) sont **portées à l'arbitrage pour @v2**, sans
qu'aucune n'ait été prise à la place de l'architecte : chacune a été traitée par
la lecture la plus conservatrice, déclarée avant le run, et incapable de
fabriquer une ressemblance.
