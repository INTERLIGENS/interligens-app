# BUILD 7 — SIMILARITY V2 · S0 → S2

Branche `feat/cc-offline-149-similarity-v2-s0-s2`, depuis `main = f31c9e6`.
**STOP avant S3.** Aucune exécution sur corpus, aucun write, aucune DDL.

> **La question produit, et rien d'autre.**
> « Quelles caractéristiques DÉMONTRÉES de ce sujet ont déjà été observées dans
> des cas antérieurs, et sur quelle PREUVE repose chaque similarité ou
> différence ? »
> Ce build ne rend AUCUN score de ressemblance-scam, et il est construit pour
> qu'on ne puisse pas en fabriquer un sans faire rougir un test.

---

## 1. Carte de réalité — S0 (lecture seule)

### Le constat qui gouverne tout le reste

**Il n'existe aucune implémentation Similarity dans ce dépôt.** Recherche
exhaustive (`rg -il "similarit"` hors `node_modules`, `.next`, `*.md`) :
**4 fichiers**, dont **zéro moteur de similarité**.

| fichier trouvé | ce que c'est réellement | verdict |
|---|---|---|
| `src/lib/security/domainCloning.ts` (+ son test) | distance de Levenshtein entre **noms d'hôte**, pour détecter un frontend clone (`pumpfun.cc` vs `pump.fun`). Anti-phishing. | **HORS SUJET** — aucune parenté |
| `src/lib/reflex/casefileMatch.ts` | REFLEX V1, **match EXACT** par mint / wallet / handle. Son en-tête dit : *« relaxed from the original "similarity > 0.75" … Fuzzy similarity is V2 »* | **PIÈGE DE NOM** — voir ci-dessous |
| `src/scripts/discover-cryptotony-type.ts` | le mot dans un titre de tableau Markdown | **BRUIT** |

> ⚠️ **Le « V2 » de `casefileMatch.ts` n'est PAS ce build.** Celui-là est un
> déclencheur STOP **retail**, à seuil (`> 0.75`), sur des chaînes. Le réutiliser
> ou hériter de son vocabulaire ferait exactement ce que R4 interdit : un score
> global et un seuil arbitraire, sur une surface retail. Ce build n'en reprend
> **ni le code, ni le nom, ni la sémantique**, et ne le touche pas.

Il n'existe donc **ni table Prisma**, **ni route API**, **ni reader/writer**,
**ni extraction de features**, **ni scoring**, **ni consommateur UI**, **ni
contrat legacy** de similarité. La carte est presque entièrement `MISSING` —
ce qui est une bonne nouvelle : **aucune archi existante ne contredit la
prémisse**, donc aucune condition de MASTER STOP n'est atteinte.

### KEEP — réutilisé tel quel, sans une ligne modifiée

| module | ce qu'on en prend | pourquoi c'est utilisable |
|---|---|---|
| `src/lib/funding-graph/` | `SharedFunderObservation` (+ `funders[].links[].txSignature`), `FunderStructure`, `QualifiedFundingRelationship.category`, `CoverageInput` | pur, versionné (`funding-graph/shared-funder@v1`), l'absence y est déjà `NOT_OBSERVED` avec motif |
| `src/lib/coordinated-exit/` | `CoExitCharacterisation.dimensions` (7 dimensions), `CoExitGroup`, `ExitCoverage` (3 couvertures séparées) | pur, `methodRef` gelé résolvable, démenti `NARROW_WINDOW_CLUSTER ≠ COORDINATED_EXIT` déjà porté |
| `src/lib/data-nature/` | `DataNature`, `leastAuthoritative` (règle §1.2), `canTransition` (I1) | c'est **la** doctrine de nature du produit ; la redériver serait le défaut S6-0 |
| `src/lib/methodology/registry.ts` | `isKnownMethodRef`, `SOCIAL_PROMOTION_QUALIFY_V1` | seul juge de « ce ref existe-t-il vraiment » |
| `src/lib/shill-correlation/` | `TokenIdentityResolution`, `ResolvedAnchor.provenance`, `PromotionQualification`, `ANALYSIS_WINDOW` | types purs ; importés en `import type` là où le module runtime tirerait `@/lib/kol/` |
| `src/lib/pre-shill/frontRun.ts` | `WalletRecurrence.qualifies`, `MIN_OCCASIONS`, `MIN_DISTINCT_KOLS`, `FRONT_RUN_RULE_VERSION` | pur, seuils gelés **avant** backtest, statut expérimental documenté |

### ADAPT — repris, mais avec une traduction explicite

| sortie amont | adaptation | pourquoi |
|---|---|---|
| `ExitCoverage` (3 couvertures) | `FeatureCoverage { complete, censoredBy, upstream }` | l'invariant a besoin d'un booléen mécanique ; **les trois partent intactes dans `upstream`**, jamais fondues |
| `materiality.status = NOT_MEASURABLE` | devient un **ÉTAT**, pas une valeur | en faire une catégorie ferait « MATCH sur NOT_MEASURABLE » : deux sujets se ressemblant par ce qu'on ne sait pas mesurer |
| `FundingRelationshipCategory.UNKNOWN` | **écarté** de l'ensemble | `UNKNOWN` est l'aveu du qualificateur, pas une propriété du sujet |
| `sharedFunder.observed === false` | `NOT_OBSERVED` + `reason` + `edgesConsidered` | l'absence garde son motif et son dénominateur |
| `PromotionQualification` | `QUALIFIED` \| `REJECTED:<critère>` | l'issue du prédicat, avec ce qui a tranché |

### RETIRE — rien

Aucun code existant n'est retiré, remplacé ni réécrit. **R1 tenu : zéro
réécriture, zéro chemin gelé touché.**

### MISSING — ce que ce build a dû créer

`src/lib/similarity/` — **pur, nouveau, isolé** : `types.ts`, `registry.ts`
(contrat), `observation.ts` (constructeur), `invariants.ts` (R2 exécutable),
`compare.ts` (comparateur), `adapters.ts` (branchement aux moteurs), `index.ts`.

---

## 2. Le contrat de feature — S1

### Trois choses qui ne sont **pas** des features, et pourquoi

| | statut | raison |
|---|---|---|
| **Data Nature** | *attribut* de chaque feature + *entrée* du comparateur (INV-6) | en faire une feature comparerait `INFERENCE` à `INFERENCE` et appellerait ça une ressemblance — c'est une propriété de la **mesure**, pas du sujet mesuré |
| **Coverage / censoring** | *attribut* (INV-4) | deux collectes également censurées ne se ressemblent pas, elles sont également aveugles |
| **Les seuils** | **jamais** un paramètre du comparateur | un seuil n'a le droit d'exister que **gelé en amont**, et il entre alors sous forme d'issue catégorielle déjà calculée |

### Les 16 features déclarées

`SIMILARITY_FEATURE_REGISTRY` est **fermé** : une clé absente lève
(`UnknownFeatureError`). Chaque entrée pointe sur un **symbole exporté existant**.

| clé | sorte | nature | source démontrée |
|---|---|---|---|
| `identity.token_resolution_status` | CATEGORICAL | INFERENCE | `resolveTokenIdentity › resolutionStatus` |
| `identity.chain_demonstrated` | CATEGORICAL | INFERENCE | `chainForMint` (`"solana"` seulement si démontrable) |
| `temporal.anchor_provenance` | CATEGORICAL | INFERENCE | `resolvePostAnchor › provenance` |
| `temporal.exit_cluster_span_seconds` | ORDINAL | INFERENCE | `dimensions.spanSeconds` |
| `temporal.exit_cluster_min_gap_seconds` | ORDINAL | INFERENCE | `canonicalProximity.minGapSeconds` |
| `funding.shared_funder_addresses` | SET | PRIMARY_OBSERVATION | `SharedFunderObservation.funders[].funder` |
| `funding.relationship_categories` | SET | INFERENCE | `QualifiedFundingRelationship.category` (**hors `UNKNOWN`**) |
| `funding.external_funder_count` | ORDINAL | PRIMARY_OBSERVATION | `FunderStructure.external` |
| `shill.promotion_qualification` | CATEGORICAL | INFERENCE | `PromotionQualification` |
| `shill.kol_handles` | SET | PRIMARY_OBSERVATION | occasions › `kolHandle` — **NOMINATIF** |
| `exit.cluster_category` | CATEGORICAL | INFERENCE | `CoExitCharacterisation.category` |
| `exit.demonstrated_venue` | CATEGORICAL | PRIMARY_OBSERVATION | `dimensions.demonstratedVenue` |
| `exit.demonstrated_destination` | CATEGORICAL | PRIMARY_OBSERVATION | `dimensions.demonstratedDestination` |
| `exit.distinct_subjects` | ORDINAL | PRIMARY_OBSERVATION | `dimensions.distinctSubjects` |
| `exit.composition_profile` | CATEGORICAL | PRIMARY_OBSERVATION | `dimensions.composition` → `SELL_ONLY` / `TRANSFER_ONLY` / `MIXED` |
| `exit.materiality` | ORDINAL | INFERENCE | `dimensions.materiality` — **existe pour être NOT_MEASURABLE** |
| `preshill.front_run_wallets` | SET | INFERENCE | `computeRecurrence › qualifies` — **EXPÉRIMENTAL** |

### Les cinq états, et pourquoi ils ne fusionnent pas

```
OBSERVED        établi, avec sa preuve
NOT_OBSERVED    le moteur a regardé l'échantillon et n'y a rien trouvé
NOT_MEASURABLE  la grandeur ne se mesure pas depuis ce qui existe
CENSORED        la collecte a été coupée avant que la question soit posée
MISSING         la caractéristique n'a jamais été extraite pour ce sujet
```

`MISSING` **n'est pas un état constructible** : `FeatureObservation.state`
l'exclut par typage. On ne peut donc pas fabriquer une absence munie d'une
nature et d'une méthode ; le comparateur la constate, il ne la reçoit pas.

`CENSORED` (l'état) et `coverage.complete = false` (l'attribut) **coexistent** et
disent deux choses : « rien n'a pu être établi » contre « une valeur existe,
mais elle est un **plancher** ».

### Ce que le constructeur REFUSE plutôt que de dégrader

Ensemble vide, chaîne vide, grandeur non finie · valeur sur un état non observé ·
état non observé sans motif · `CENSORED` avec couverture complète · couverture
incomplète sans cause · unité ou sorte contredisant le registre · valeur hors
vocabulaire fermé · paramètre de méthode exigé absent · `OBSERVED` sans preuve
opposable. **`nature`, `experimental` et `nominative` ne sont jamais fournis par
l'appelant** : ils viennent du registre — un adaptateur ne peut donc pas
requalifier une INFERENCE ni effacer un drapeau expérimental.

---

## 3. Sémantique du comparateur — S2

### L'ordre d'évaluation est une règle, pas un détail

```
1. observabilité   un côté non observé arrête tout            → INV-2
2. méthode         deux méthodes différentes ne se comparent   → INV-9
3. sorte ORDINAL   une grandeur n'est pas jugée sans seuil     → INV-8
4. valeurs         égalité / recouvrement d'ensembles
5. censure         un négatif candidat est RETIRÉ              → INV-4
```

À chaque embranchement, **c'est la lecture la plus faible qui l'emporte**.

### Le vocabulaire, fermé

| verdict | motifs autorisés |
|---|---|
| `MATCH` | `EQUAL_VALUE`, `IDENTICAL_SET` |
| `PARTIAL_MATCH` | `SET_OVERLAP_PARTIAL` |
| `DIFFERENT` | `VALUE_DIFFERS`, `SET_DISJOINT` |
| `NOT_COMPARABLE` | `SIDE_NOT_OBSERVABLE`, `COVERAGE_CENSORED_NEGATIVE_WITHHELD`, `METHOD_MISMATCH`, `ORDINAL_REQUIRES_UNDECLARED_THRESHOLD` |

Tout autre couple lève. **Aucun nombre, aucun rang, aucun seuil** n'existe dans
la sortie — `assertNoAggregateScore` refuse récursivement toute clé du genre
`score` / `similarity` / `confidence` / `weight` / `ratio` / `threshold`.

### La base exposée par chaque résultat

`featureKey` · `comparedOn` · `meaning` (le sens gelé, **démentis compris**) ·
les deux côtés complets (état, valeur, motif d'état, nature, méthode +
paramètres, couverture + `upstream`, preuves) · `overlap` en trois listes
(`shared` / `onlyLeft` / `onlyRight`, **jamais un ratio**) · `resultIsFloor` ·
`reasonCode` + `reason` · `experimental` · `nominative` · `ruleVersion` ·
`resultNature` · les **réserves**.

### Trois décisions de conception, et leur défense

**a) Une grandeur n'est jamais jugée.** 191 s contre 185 s est tentant. Dire
« proche » exigerait une coupure qu'**aucune règle ratifiée ne pose**, et un
seuil choisi ici ne mesurerait que lui-même. Les deux valeurs sont donc
**transportées** et le verdict est `NOT_COMPARABLE` avec le motif qui le dit.
L'égalité fortuite ne vaut pas davantage : deux durées égales sont une
coïncidence, pas une ressemblance.

**b) La censure est asymétrique.** Elle **retire les négatifs**, jamais les
positifs. Un identifiant démontré des deux côtés le reste, quelle que soit la
borne de collecte ; c'est le **négatif** seul qui dépend de ce qu'on n'a pas vu.
Un `DIFFERENT` candidat sous censure devient `NOT_COMPARABLE` ; un
`PARTIAL_MATCH` survit, marqué `resultIsFloor`.

**c) `compareSubjects` rend une entrée par feature du registre, même absente des
deux côtés.** Ne rendre que les features présentes ferait varier la longueur de
la sortie avec l'ignorance : deux sujets mal couverts sembleraient avoir « peu
de différences ».

### Ce que le comparateur ne fait pas — et l'`InferenceEnvelope`

`buildInferenceEnvelope` n'est **pas** utilisé ici, délibérément. Son contrat
refuse `INFERENCE` parmi les natures de **sources** ; or plusieurs côtés
comparés *sont* des INFERENCE (`exit.cluster_category`,
`funding.relationship_categories`). Les y faire entrer lèverait
`InferenceAsOwnBasisError` ; les en retirer perdrait exactement l'attribution
que R2 exige. `ComparisonBasis` porte donc l'attribution **structurellement**
(les deux côtés entiers, avec leurs natures, méthodes, couvertures et preuves),
ce qui est strictement plus riche. **C'est une question ouverte pour toute
persistance future** — voir §6.

---

## 4. Tests et preuve de mutation

### La suite

| fichier | tests | ce qu'il fixe |
|---|---|---|
| `__tests__/contract.test.ts` | 15 | registre fermé, refus du constructeur, tripwire méthodologie |
| `__tests__/comparator.test.ts` | 17 | les 4 verdicts, les 5 états, asymétrie de la censure, propagation des drapeaux |
| `__tests__/mutation.test.ts` | 31 | **les 9 mutants** |
| `__tests__/adapters.test.ts` | 15 | les adaptateurs branchés sur les **vrais moteurs** (pas de faux objets) |

**Suite complète du dépôt : 366 fichiers, 4 540 tests verts, 2 skipped.**
`tsc --noEmit` : 0 erreur. ESLint sur `src/lib/similarity/` et
`scripts/similarity/` : 0 problème.

### La preuve de mutation — mécanique, pas déclarative

`node scripts/similarity/mutation-check.mjs` neutralise **chaque garde une par
une** (`throw new XError(…)` → `SKIP(new XError(…))` : les arguments sont
toujours évalués, seul le **refus** disparaît), relance `mutation.test.ts`, et
vérifie qu'**exactement** le bloc MUTANT correspondant devient rouge.

```
✅ INV-1 · StateCollapseError             → rouge : MUTANT 1
✅ INV-2 · AbsenceBecameFindingError      → rouge : MUTANT 2
✅ INV-3 · EmptyObservationError          → rouge : MUTANT 3
✅ INV-4 · CensoredNegativeError          → rouge : MUTANT 4
✅ INV-5 · ExperimentalLaunderedError     → rouge : MUTANT 5
✅ INV-6 · NatureUpRankError              → rouge : MUTANT 6
✅ INV-7 · UnattributableComparisonError  → rouge : MUTANT 7
✅ INV-8 · ForbiddenConclusionError       → rouge : MUTANT 8
✅ INV-9 · MethodMismatchNotFlaggedError  → rouge : MUTANT 9

✅ Les 9 gardes sont portantes, et chacune ne couvre que son bloc.
```

**Correspondance 1 : 1, vérifiée dans les deux sens.** Aucune neutralisation ne
fait rougir un bloc étranger : chaque mutant viole exactement un invariant et
satisfait les huit autres. C'est la différence entre un invariant qui **tient**
et un invariant qui **tient par omission** — le défaut que S6 avait dû reprendre
sur Data Nature.

### Les 9 invariants et leur mutant

| INV | l'énoncé | le mutant refusé |
|---|---|---|
| 1 | les cinq états ne fusionnent pas | un `NOT_MEASURABLE` transcrit `NOT_OBSERVED` ; un état non observé qui transporte une valeur ; un motif générique qui ne nomme pas les états |
| 2 | l'absence ne devient jamais un constat | « l'un a RAYDIUM, l'autre rien, donc ils **DIFFÈRENT** » ; « les deux n'ont rien, donc ils se **RESSEMBLENT** » |
| 3 | une observation doit affirmer quelque chose | un **ensemble vide** présenté comme valeur observée |
| 4 | la censure ne fabrique pas de différence | un `DIFFERENT` sous couverture bornée ; un résultat censuré qui ne se déclare pas plancher |
| 5 | l'expérimental ne se blanchit pas | un résultat PRE-SHILL présenté comme canonique ; la réserve retirée |
| 6 | la nature ne remonte pas l'échelle | `INFERENCE` promue `PRIMARY_OBSERVATION` ; un côté requalifié contre le registre ; une nature posée sur un `MISSING` |
| 7 | chaque comparaison est attribuable | verdict sans preuve ; `methodRef` grammaticalement valide mais **irrésoluble** ; paramètre de méthode exigé absent |
| 8 | vocabulaire fermé, aucun score, aucun seuil | un motif qui **conclut** (`…signe de coordination…`) ; un couple hors vocabulaire ; une clé `similarityScore` ; une **grandeur jugée** |
| 9 | deux méthodes différentes ne se comparent pas | un `MATCH` obtenu en ignorant la fenêtre — alors que **les valeurs sont identiques** |

---

## 5. Ce que VINE et BOTIFY peuvent réellement exercer en S3

> Cette section est un **inventaire de faisabilité**, mesuré sur le dépôt et sur
> le snapshot de schéma. Aucune ligne de corpus n'a été lue.

### Ce qui existe en base — `__schema-snapshot.json`, ep-square-band, 2026-09-05

| table | présente | conséquence |
|---|---|---|
| `ExitEvent` | ✅ | `exit.*` + `temporal.exit_*` alimentables |
| `CoExitQualification` | ✅ | les 7 dimensions déjà persistées |
| `FundingEdge` | ✅ | arêtes disponibles |
| **`FundingRelationship`** | ❌ **absente** | `funding.relationship_categories` doit être **recalculé à la volée** (`qualifyFundingRelationship` est pur — c'est possible), mais **la couverture n'est stockée nulle part** : elle devra être reconstruite ou déclarée |
| `ShillEvent` | ✅ | `shill.promotion_qualification` alimentable |

### VINE — le corpus le plus solide

`docs/reports/build6-f2-write.md` et `build6-packC-f2-persistence.md` rapportent
**458 `ExitEvent` + 6 `CoExitQualification`** écrits, et
`src/lib/coordinated-exit/types.ts` documente une mesure du **2026-09-05 sur le
corpus VINE** (30 échanges sur 453 rendent l'actif de contrepartie plusieurs
fois). VINE peut donc exercer **réellement** :

- `exit.cluster_category` — 6 groupes, tous `NARROW_WINDOW_CLUSTER` ;
- `exit.demonstrated_venue` — `RAYDIUM` unanime sur 3 groupes, **absent sur 3** →
  exerce le chemin `NOT_OBSERVED` sur des données réelles ;
- `exit.demonstrated_destination` — `5Q544fKrFo…` unanime, **sans label** ;
- `exit.composition_profile` — un groupe à `37/0` (SELL_ONLY), un à `2/1` (MIXED) ;
- `exit.distinct_subjects`, `temporal.exit_cluster_span_seconds`,
  `temporal.exit_cluster_min_gap_seconds` — **exercent le refus ORDINAL** (191 s
  contre 185 s : le cas exact qui fait dire « proche » à un lecteur pressé) ;
- `exit.materiality` — `NOT_MEASURABLE` **6 fois sur 6** : c'est le meilleur
  exerciseur d'INV-1 que le produit possède.

### BOTIFY — utile, mais avec un piège nommé

BOTIFY porte des `KolTokenLink`, un casefile publié et une table de preuves
exportée : il peut exercer `identity.*`, `shill.promotion_qualification` et
`shill.kol_handles`.

> ⚠️ **`UnZacija4` (mint réel, on-chain) et `UnZacja4` (clé de casefile
> synthétique/démo) ne sont PAS une coquille.** Les « corriger » casserait soit
> la jointure casefile, soit des snapshots d'anti-régression. En S3, le sujet
> BOTIFY doit être **désigné par un `subjectRef` explicite**, et le mint utilisé
> pour la collecte doit être tranché **avant** l'exécution, pas pendant.

### La comparaison VINE ↔ BOTIFY, honnêtement

Sur les **16 features**, la plupart des couples tomberont en `NOT_COMPARABLE` —
et **c'est le résultat correct**, pas un échec du moteur :

- les features `exit.*` n'existeront que du côté VINE → `MISSING` côté BOTIFY ;
- `funding.shared_funder_addresses` : la photo de financement est **partielle par
  construction** (`snapshot.ts` : sur le sujet #1, **29 acquéreurs, 10 seulement
  visibles comme destinataires de SOL, et aucun bailleur n'en touche deux**).
  Le résultat le plus probable est `NOT_OBSERVED` des deux côtés → `NOT_COMPARABLE` ;
- `preshill.front_run_wallets` : le corpus réel est de **8 occasions sur 3 KOL**.
  Marqué expérimental, il ne peut rien rendre canonique.

**Une comparaison majoritairement `NOT_COMPARABLE` est la réponse juste à la
question produit.** Un moteur qui rendrait « 62 % de similarité » sur ces mêmes
données aurait fabriqué un chiffre à partir d'absences.

---

## 6. Limites non résolues

1. **`similarity/compare@v1` ne résout sur aucun artefact de méthodologie gelé.**
   Geler un artefact est une décision de doctrine, pas un effet de bord d'un
   build de code. En attendant, **chaque résultat porte la réserve
   `METHODOLOGY ARTIFACT NOT FROZEN`** et un test *tripwire* affirme que le ref
   **ne résout pas** — il rougira le jour du gel et forcera le retrait de la
   réserve. **Aucune sortie n'est publiable ni persistable avant ce gel.**

2. **La persistance est une question ouverte, pas une omission.** Le comparateur
   n'écrit rien et aucune table n'est proposée. Persister exigerait de trancher
   le conflit `InferenceEnvelope` décrit en §3 (une comparaison a des entrées de
   nature `INFERENCE`, que l'enveloppe refuse comme sources) — **c'est une
   décision d'architecture, et elle n'est pas prise ici.**

3. **INV-6 est aujourd'hui partiellement structurel.** Les deux côtés d'une
   feature partagent la nature déclarée au registre, donc
   `leastAuthoritative(a, b)` est constante par construction ; ce qui porte
   réellement, c'est le refus de requalifier un côté contre le registre et le
   `resultNature = null` sur un `MISSING`. La règle §1.2 ne deviendra pleinement
   active que si une feature admet une nature variable par observation.

4. **`funding.relationship_categories` n'a pas de source persistée** (table
   `FundingRelationship` absente en base). Le recalcul à la volée est possible ;
   **la couverture, elle, devra être reconstruite ou déclarée** — et une
   couverture déclarée à la légère armerait un `DIFFERENT` que INV-4 devrait
   refuser.

5. **Les ORDINAL ne sont jamais comparés.** C'est délibéré, et c'est une perte
   assumée : deux fenêtres de 191 s et 185 s se lisent, mais ne se comparent pas.
   Lever cette limite demanderait un seuil **ratifié**, donc une décision
   méthodologique — hors de ce build.

6. **`shill.kol_handles` est nominatif.** Le drapeau et sa réserve voyagent
   jusqu'au résultat, mais **aucune frontière de publication n'est câblée** :
   ce module n'a aucun consommateur, et il ne doit pas en avoir avant S3.

7. **Les adaptateurs `identity.*`, `temporal.anchor_provenance`,
   `shill.*` et `preshill.*` exigent les `EvidenceRef` de l'appelant**, parce que
   les types amont ne les portent pas. En S3, un appelant qui passerait une liste
   vide serait refusé par INV-7 — c'est voulu, mais cela déplace une charge réelle
   sur la couche de collecte.

---

## 7. Attestation

- **0 appel réseau, 0 Helius, 0 Prisma, 0 lecture de base.** Le module n'importe
  ni `prisma` ni aucun client HTTP ; les types amont sont tirés en `import type`
  là où le module runtime chargerait `@/lib/kol/`.
- **0 write prod, 0 DDL, 0 migration, 0 modification du registre Data Nature.**
- **0 chemin gelé touché.** Fichiers ajoutés : `src/lib/similarity/**`,
  `scripts/similarity/mutation-check.mjs`, `docs/reports/build7-s0-s2.md`.
  Aucun n'est couvert par `FORBIDDEN_PATTERNS` de `scripts/guard-offline.sh`.
- **0 dépendance ajoutée** — la vérification de mutation est écrite à la main
  parce que Stryker aurait été une dépendance, et R4 les interdit.
- **0 seuil, 0 score, 0 embedding, 0 LLM.**
- **Aucun verdict** : ni culpabilité, ni scam, ni coordination, ni opérateur
  commun. La garde lexicale d'INV-8 le tient sur le motif, et un mutant le prouve.

**Conditions de MASTER STOP : aucune atteinte.** L'archi existante ne contredit
pas la prémisse (elle est vide), aucune décision produit n'était requise pour
livrer un module pur, aucune DDL n'a été nécessaire, et les données stockées
soutiennent la sémantique proposée — avec la réserve mesurée du §5 sur
`FundingRelationship`.

**S3 n'est pas démarré et attend ratification.**
