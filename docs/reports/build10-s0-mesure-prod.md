# BUILD 10 / S0 — mesure de ce que la production SERT et de ce que la base CONTIENT

Reconnaissance **entièrement en lecture seule**. `0 write · 0 DDL · 0 collecte ·
0 Helius · 0 RPC · 0 déploiement · 0 merge.`

Lectures base en `BEGIN TRANSACTION READ ONLY` + `ROLLBACK`, cible
`ep-square-band` assertée avant connexion. Surfaces HTTP en `GET`. PDF contrôlés
sur le **texte extrait**, jamais sur le flux.

| | |
|---|---|
| `main` | `4d5cdcccb4b4977bf676ffd33bbfe62fd7d8c4c7` — figé |
| guard | `ce13d0c0f987483786c26346c832fb8ff5e082206259bc46c23073f8b9013e50` · 0 exemption |
| production | `app.interligens.com` (déploiement `mjyo7j3xe`, BUILD 9 servi) |
| début | 2026-09-08 |

**Catégories** — chaque écart tombe dans exactement une :
`DATA_ABSENT` · `NOT_MEASURABLE` · `PIPE_NOT_CONNECTED` · `COLLECTOR_MISSING` ·
`BUG` · `INTENTIONALLY_NOT_SHOWN`

> Ce document est écrit **au fil de l'eau** et poussé à chaque surface terminée.
> Une section absente signifie « pas encore mesurée », jamais « rien à dire ».

---

# S1 · `/api/kol/[handle]` — les 32 profils publiés

**32 interrogés, 32 servis, 0 en 404.** Mesure champ par champ sur les 32
réponses, puis confrontation à `KolProfile` filtré par `PUBLIC_KOL_FILTER`.

## Champs pleins — aucun écart

| champ | sortie sur 32 | base | écart | catégorie |
|---|---|---|---|---|
| `handle` · `platform` · `riskFlag` · `confidence` · `verified` | valeur ×32 | peuplé ×32 | — | — |
| `publishStatus` · `publishable` | valeur ×32 | peuplé ×32 | — | — |
| `proceedsCoverage` · `proceedsPublication` · `proceedsSource` | valeur ×32 | peuplé ×32 | — | — |
| `lastScannedAt` | valeur ×32 | `lastHeliusScan` peuplé ×32 | — | — |
| `snapshotVersion` · `identityResolutionVersion` · `freshness` | valeur ×32 | dérivés | — | — |
| `identityConfidence` · `walletAttributionMode` | valeur ×32 | dérivés des wallets | — | — |
| `completenessLevel` · `evidenceDepth` · `profileStrength` · `behaviorFlags` | valeur ×32 | dérivés | — | — |
| `_count` · `proceedsProvenance` | objet peuplé ×32 | dérivés | — | — |

## Champs partiellement vides — la base est vide, pas le lecteur

| champ | sortie observée | état en base (32 publiés) | écart | catégorie |
|---|---|---|---|---|
| `bio` | 25 valeur · **7 `null`** | 25 peuplé · 7 `NULL` | **aucun** | `DATA_ABSENT` |
| `displayName` | 30 valeur · **2 `null`** | 30 peuplé · 2 `NULL` | **aucun** | `DATA_ABSENT` |
| `tier` | 27 valeur · **5 `null`** | 27 peuplé · 5 `NULL` | **aucun** | `DATA_ABSENT` |
| `summary` | 9 valeur · **23 `null`** | 9 peuplé · 23 `NULL` | **aucun** | `DATA_ABSENT` |
| `evmAddress` | 3 valeur · **29 `null`** | 3 peuplé · 29 `NULL` | **aucun** | `DATA_ABSENT` |
| `exitDate` | 2 valeur · **30 `null`** | 2 peuplé · 30 `NULL` | **aucun** | `DATA_ABSENT` |
| `totalScammed` | 4 valeur · **28 `null`** | 4 peuplé · 28 `NULL` | **aucun** | `DATA_ABSENT` |
| `followerCount` | 27 valeur · 1 zéro · **4 `null`** | 28 peuplé (dont 1 à `0`) · 4 `NULL` | **aucun** | `DATA_ABSENT` |
| `walletDataFreshAt` | 3 valeur · **29 `null`** | dérivé de `discoveredAt` des wallets | **aucun** | `DATA_ABSENT` |

Dans les neuf cas, **le vide en sortie est le vide en base, au profil près**. Le
lecteur ne perd rien.

## Zéros réels — à ne pas confondre avec des absences

| champ | sortie | base | lecture |
|---|---|---|---|
| `rugCount` | 25 à `0` · 7 valeur | **32 peuplé**, dont 25 à `0` | le `0` est une valeur mesurée, pas un défaut de lecture |
| `walletCount` | 26 valeur · 6 à `0` | 26 profils portent ≥ 1 wallet | aligné |

## Relations — alignées, mais la mesure demande de la précision

| champ | sortie | base | lecture | catégorie |
|---|---|---|---|---|
| `wallets` | **10 peuplés · 22 vides** | 26 profils portent des wallets, mais **10 seulement** portent ≥ 1 wallet publiable | **aucun écart** — le filtre de publiabilité explique les 16 autres | `INTENTIONALLY_NOT_SHOWN` (16) · `DATA_ABSENT` (6) |
| `evidences` / `evidenceCount` | **10 peuplés · 22 vides** | `KolEvidence` : **61 lignes sur 10 profils** | **aucun écart** | `DATA_ABSENT` (22) |
| `caseLinks` | **6 peuplés · 26 vides** | `KolCase` : **11 lignes sur 6 profils** | **aucun écart** | `DATA_ABSENT` (26) |

> **Piège écarté par la mesure** : 26 profils portent des wallets en base et 10
> seulement en servent. Lu vite, cela ressemble à une perte de 16 profils. C'est
> le filtre de publiabilité de BUILD 8 : ces 16 profils n'ont **aucun** wallet
> `isPubliclyUsable=true`. La distribution est très concentrée — `Myrrha` porte
> **113 wallets, tous publiables**, soit 69 % des 164 servis.

## Les montants — un retrait signalé, jamais silencieux

**8 profils** portent un `totalDocumented` non nul en base. La sortie n'en montre
que **2**.

| handle | `totalDocumented` en base | `proceedsPublication` | servi | catégorie |
|---|---|---|---|---|
| `OrbitApe` | 817 000 | `withdrawn` | **`null`** | `INTENTIONALLY_NOT_SHOWN` |
| `GordonGekko` | 579 645 | `withdrawn` | **`null`** | `INTENTIONALLY_NOT_SHOWN` |
| `James` | 380 000 | `withdrawn` | **`null`** | `INTENTIONALLY_NOT_SHOWN` |
| `bkokoski` | 210 900 | `withdrawn` | **`null`** | `INTENTIONALLY_NOT_SHOWN` |
| `sxyz500` | 141 594 | `withdrawn` | **`null`** | `INTENTIONALLY_NOT_SHOWN` |
| `Myrrha` | 127 036 | `withdrawn` | **`null`** | `INTENTIONALLY_NOT_SHOWN` |
| `0xBossman` | 2 932 | `published` | **2 932** | — |
| `Geppetto` | 2 082 | `published` | **2 082** | — |

**2 256 175 $ retirés de la publication**, sur 6 profils.

Trois propriétés vérifiées sur ces six :

1. le montant sort en **`null`**, jamais en `0` — aucune substitution ;
2. le retrait est **signalé** : `proceedsPublication: "withdrawn"` accompagne
   chaque `null`, sur la même réponse. Un consommateur distingue « retiré » de
   « absent » sans lire le code ;
3. `proceedsCoverage` reste servi (`none` ou `partial`) — l'étendue de la
   couverture n'est pas masquée par le retrait du montant.

**Ce ne sont donc pas des blancs silencieux.**

### Une asymétrie à consigner, sans la trancher

`bkokoski` sert `totalScammed: 4 500 000` **à côté** d'un `totalDocumented`
retiré. `sxyz500` sert `totalScammed: 1 200 000` dans la même configuration.

C'est le comportement documenté dans `canonical.ts` : `totalScammed` relève de
la famille `scam_scale`, qui a son propre interrupteur — l'ampleur du préjudice
et l'encaissement ne sont pas la même affirmation. **Conforme au contrat**, donc
pas un écart. Je le note parce qu'un lecteur Investor/Counsel verra un profil
dont le gain est retiré et le préjudice affiché, et que cette asymétrie est un
choix, pas un accident.

## Le seul champ constamment vide

| champ | sortie | base | catégorie |
|---|---|---|---|
| `builtFromEventId` | **`null` ×32** | — | `INTENTIONALLY_NOT_SHOWN` |

`toSnapshot` dans `src/lib/kol/canonical.ts` pose littéralement
`builtFromEventId: null`. Ce n'est pas une lecture qui échoue : le champ existe
dans le contrat de snapshot et n'est jamais alimenté par cette projection.
**Champ mort en sortie**, à qualifier — il occupe une place dans le contrat sans
jamais rien porter.

## Bilan S1

| catégorie | champs |
|---|---|
| `DATA_ABSENT` | 9 champs scalaires + 2 relations |
| `INTENTIONALLY_NOT_SHOWN` | 6 montants retirés · 16 profils sans wallet publiable · `builtFromEventId` |
| `BUG` | **0** |
| `PIPE_NOT_CONNECTED` | **0 sur cette surface** |
| blancs silencieux | **0** — tout vide est soit un vide en base, soit un retrait signalé |

**Aucun écart entre ce que la base contient et ce que l'API sert**, hors les
retraits qui sont déclarés. Cette surface est saine.

---

# S2 · Les dossiers CaseFile — corpus, preuve, et deux tables orphelines

## Le corpus réel

`token_casefiles` porte **4 dossiers**. Un seul est publié.

| ref | codename | `publishStatus` | `tigerScore` | verdict | `publishedDate` |
|---|---|---|---|---|---|
| `IL-PND-LAB-001` | **LAB** | **`published`** | 91 | AVOID | 2026-05-20 |
| `IL-CONC-BLACKBULL-001` | BLACKBULL | `draft` | 0 | CONCENTRATION_RISK | `null` |
| `IL-SHILL-BOTIFY-001` | BOTIFY | `draft` | `null` | UNDETERMINED | `null` |
| `IL-SHILL-VINE-001` | VINE | `draft` | `null` | UNDETERMINED | `null` |

> **À consigner** : les deux dossiers que les surfaces CaseFile servent — BOTIFY
> et VINE — sont en **`draft`**, avec `verdict: UNDETERMINED` et `tigerScore: null`.
> Le seul dossier `published`, LAB, n'est **pas** celui que `/api/casefile` rend
> sur les mints mesurés. Non instruit ici : je le note, je ne le tranche pas.

Volumétrie des tables du domaine :

| table | lignes | |
|---|---|---|
| `CaseFileClaim` | **16** | 8 BOTIFY + 8 VINE |
| `CaseFileSource` | **8** | **BOTIFY seul** |
| `CaseFileShiller` | **9** | **VINE seul** |
| `CaseFileSmokingGun` | **1** | **VINE seul** |
| `token_casefiles` | 4 | |
| `platform_casefiles` | 1 | |
| `VaultCaseFile` · `casefiles` | **0** | tables vides |

## L'écart de couverture de preuve — BOTIFY contre VINE

Les deux dossiers ne manquent pas des mêmes choses. Ils sont **complémentaires**,
et c'est le fait central de cette section.

| champ (8 claims chacun) | BOTIFY | VINE | catégorie |
|---|---|---|---|
| scellés (`contentHash`) | **8/8** | **8/8** | — |
| `description` / `descriptionFr` | 8/8 | 8/8 | — |
| **`evidenceRefs`** | **8/8 peuplés** | **0/8 — tous vides** | `DATA_ABSENT` (VINE) |
| **`claimDate`** | **0/8 — tous `NULL`** | **8/8 peuplés** | `DATA_ABSENT` (BOTIFY) |
| `threadUrl` | 6/8 | **8/8** | `DATA_ABSENT` (BOTIFY ×2) |
| `actors` | **0/8 `NULL`** | **8/8 peuplés** | `DATA_ABSENT` (BOTIFY) |
| lignes `CaseFileSource` | **8** | **0** | `DATA_ABSENT` (VINE) |
| lignes `CaseFileShiller` | **0** | **9** | `DATA_ABSENT` (BOTIFY) |
| lignes `CaseFileSmokingGun` | **0** | **1** | `DATA_ABSENT` (BOTIFY) |

**BOTIFY porte ses références et ses sources, mais aucune date et aucun acteur.
VINE porte ses dates, ses acteurs, ses shillers et son smoking gun, mais aucune
référence de preuve.**

### Ce qui manquerait pour que VINE porte de la preuve

Deux écritures, dans cet ordre, et aucune n'existe aujourd'hui :

1. **Des lignes dans `CaseFileSource`** pour `IL-SHILL-VINE-001`. La table est à
   **0** pour ce dossier. Chaque ligne demande au minimum `sourceId`,
   `sourceType`, `caption` et `capturedAt` — les quatre champs que BOTIFY
   remplit.
2. **`evidenceRefs` peuplé** sur les 8 claims VINE, pointant vers ces `sourceId`.
   Aujourd'hui les 8 portent `[]`.

Tant que le premier point n'est pas fait, peupler le second produirait **8
`BROKEN_REFERENCE`** — une référence en forme de clef qui ne résout pas. L'ordre
n'est pas cosmétique.

### Pourquoi l'audit d'intégrité est vert sur VINE

`auditClaims` ne lève `BROKEN_REFERENCE` qu'**en parcourant `evidenceRefs`**.
Sur un tableau vide, la boucle ne s'exécute pas. Le vert de VINE ne dit donc pas
« ses références résolvent » : il dit **« il n'y a rien à vérifier »**.

C'est exactement l'écart signalé en clôture de BUILD 9, et il est ici mesuré :
**0 source au registre, 0 référence, 0 constat.**

### La qualité de la preuve BOTIFY, elle aussi mesurée

Les 8 sources de BOTIFY ne sont pas complètes :

| champ de `CaseFileSource` | peuplé sur 8 | catégorie |
|---|---|---|
| `sourceType` · `filename` · `caption` · `capturedAt` | **8/8** | — |
| **`sourceUrl`** | **0/8** | `DATA_ABSENT` |
| **`sha256`** | **0/8** | `DATA_ABSENT` |
| **`snapshotId`** | **0/8** | `DATA_ABSENT` |

Les 8 sources sont des captures nommées et datées, **sans URL, sans empreinte et
sans snapshot**. Un lecteur Counsel ne peut donc pas les vérifier de façon
indépendante : il lit une légende et une date, pas une pièce opposable.

**Ce n'est pas un blanc silencieux** — la projection publique rend `source_url:
null` et `sha256: null` explicitement, mesuré sur `/api/casefile`. Mais c'est un
plafond de couverture qu'il faut nommer.

## Deux tables écrites que rien ne lit

| table | lignes | lue par le lecteur canonique ? | catégorie |
|---|---|---|---|
| `CaseFileShiller` | **9** (VINE) | **NON** | **`PIPE_NOT_CONNECTED`** |
| `CaseFileSmokingGun` | **1** (VINE) | **NON** | **`PIPE_NOT_CONNECTED`** |

Vérifié : ni `canonicalReader.ts`, ni `publicProjection.ts`, ni `internalView.ts`
ne les interrogent. `pdfGeneratorPublic.ts` n'en fait **aucune** mention. Les
deux noms n'apparaissent dans `src/` que comme **types TypeScript** dans
`pdfGenerator.ts` — `CaseFileInput.shillers` et `smoking_guns` — c'est-à-dire la
forme d'une charge fournie à `/api/casefile/generate`, jamais une lecture de
table.

**Dix lignes de données existent en base et ne sont servies par aucune surface.**

## Cinq colonnes déclarées, jamais écrites

`CaseFileClaim` porte cinq colonnes à **0/16 peuplées**, sur les deux dossiers :

| colonne | peuplée | mentionnée dans `src/lib/casefile/` | catégorie |
|---|---|---|---|
| `rowNature` | **0/16** | 1 fois — dans le SQL de supplantation, comme colonne reportée | `PIPE_NOT_CONNECTED` |
| `natureBasis` | **0/16** | **0 fois** | `PIPE_NOT_CONNECTED` |
| `methodRef` | **0/16** | **0 fois** | `PIPE_NOT_CONNECTED` |
| `exclusionReason` | **0/16** | 1 fois — dans un **commentaire** | `PIPE_NOT_CONNECTED` |
| `excludedField` | **0/16** | **0 fois** | `PIPE_NOT_CONNECTED` |

Conséquence mesurée et contre-intuitive : le PDF public affiche
`REASON: Excluded from publication · FIELD: state`. Cette mention **n'est pas
lue depuis `exclusionReason` / `excludedField`** — ces colonnes sont vides. Elle
est **dérivée de `state`** au rendu. Les deux colonnes prévues pour porter le
motif existent en base et ne servent à rien.

## Aucun écrivain applicatif pour le corpus CaseFile

Recherche d'une écriture sur `CaseFileClaim` dans tout `src/` : **une seule
occurrence**, `renderSupersedeSql` dans `sealGuard.ts`, qui **rend du SQL et ne
l'exécute jamais**.

**Aucun code applicatif n'insère, ne met à jour ni ne supprime un claim.** Les
16 lignes proviennent des patches SQL appliqués à la main dans Neon. Il n'existe
donc **pas de collecteur** pour ce corpus.

| objet | catégorie |
|---|---|
| écrivain / collecteur de claims CaseFile | **`COLLECTOR_MISSING`** |
| écrivain / collecteur de sources CaseFile | **`COLLECTOR_MISSING`** |

C'est la raison structurelle pour laquelle VINE n'a pas de sources : **rien ne
peut lui en créer** sans passer par un patch SQL écrit à la main.

## C13 — la question tranchée par la mesure

L'énoncé était de chercher s'il a existé, **sans présumer qu'il manque**.

| recherche | résultat |
|---|---|
| lignes `CaseFileClaim` avec `claimId='C13'` | **aucune** |
| `claimId` distincts en base | `C1`…`C12`, `C14`…`C17` — **16 valeurs** |
| claims portant un `supersedes` | **aucun**, sur les 16 |
| occurrences de `C13` dans les patches `docs/prep/patches/BUILD9/*.sql` | **0** |
| occurrences de `C9`…`C12`, `C14`…`C17` dans ces mêmes patches | **2 chacune** |
| occurrences de `C13` ailleurs dans le dépôt | **0** — les seuls résultats sont un contrat USDT `0xdAC17F…C13D831ec7`, sans rapport |

**`C13` n'a jamais existé.** La source d'insertion elle-même saute ce numéro,
alors qu'elle nomme deux fois chacun de ses voisins. Ce n'est pas une
suppression, c'est un trou de numérotation à la rédaction.

**Catégorie : aucune.** Il n'y a pas de donnée absente — il n'y a jamais eu de
donnée.

> **Observation de méthode** : le constat `VERSION_GAP` de l'audit d'intégrité
> détecte les trous dans la suite des `version` **d'un même `claimId`**. Il ne
> regarde pas la suite des `claimId`. Un identifiant manquant dans la série est
> donc structurellement invisible à l'audit. Ce n'est pas un défaut — c'est hors
> de son périmètre déclaré — mais il faut le savoir avant de lire un audit vert
> comme une garantie d'exhaustivité.

## Bilan S2

| catégorie | objets |
|---|---|
| `DATA_ABSENT` | `evidenceRefs` VINE (8) · `claimDate` BOTIFY (8) · `actors` BOTIFY (8) · `threadUrl` BOTIFY (2) · `CaseFileSource` VINE (0 ligne) · `sourceUrl`/`sha256`/`snapshotId` BOTIFY (8 chacun) |
| `PIPE_NOT_CONNECTED` | `CaseFileShiller` (9 lignes) · `CaseFileSmokingGun` (1 ligne) · 5 colonnes de `CaseFileClaim` |
| `COLLECTOR_MISSING` | écrivain de claims · écrivain de sources |
| `BUG` | **0** |
| sans catégorie | `C13` — n'a jamais existé |

---

# S3 · Les collecteurs — 17 crons déclarés, 2 traçables

Mesure faite à **2026-09-08 06:43 UTC**. Les fraîcheurs sont calculées par
Postgres (`now() - max(...)`), pas par mon horloge.

## Ce qui est déclaré

`vercel.json` déclare **17 crons**. Le plan Vercel est Pro (40 autorisés), donc
aucun n'est bloqué par le quota.

## Ce qui est traçable

`JobRunLog` — 296 lignes, du 2026-06-29 au 2026-09-08 — ne porte que **2 noms de
job** :

| `jobName` | runs | dernier | `success` | autre statut |
|---|---|---|---|---|
| `watcher_bridge_promote` | 281 | **il y a 0 h** | **11** | **270 × `disabled`** |
| `watcher_v2_scan` | 15 | **il y a 1 h** | **15** | 0 |

**Les 15 autres crons n'écrivent aucune trace d'exécution.** Leur passage n'est
donc **pas mesurable depuis la base** : je ne peux pas distinguer « a tourné et
n'a rien trouvé » de « n'a pas tourné ». C'est en soi un constat.

> `watcher_bridge_promote` tourne, répond, et rend **`disabled` 270 fois sur
> 281**. Le cron est armé et le travail ne se fait pas. Ce n'est pas une panne
> silencieuse — le statut le dit — mais un lecteur qui compterait les
> exécutions le croirait actif.

## Fraîcheur réelle des pipelines

Relevé sur les **145 tables** portant un `createdAt` :

| état | tables |
|---|---|
| **vivantes** (< 3 j) | **15** |
| **dormantes** (≥ 3 j) | **75** |
| **vides** (0 ligne) | **55** |

### Pipelines vivants — le cron produit

| table | lignes | dernier écrit | cron déclaré | verdict |
|---|---|---|---|---|
| `WatcherCampaign` | 3 790 | **1 h** | `watcher-v2` 06:00 | **actif** |
| `WatcherDigest` | 20 | **1 h** | `weekly-digest` lun 08:00 | **actif** |
| `social_post_candidates` | 7 797 | **1 h** | `daily-flow` 02:00 | **actif** |
| `KolProceedsEvent` | 5 602 | **3 h** | `helius-scan` 04:00 | **actif** |
| `DomainEvent` | 3 981 | **3 h** | `process-events` 03:00 | **actif** |
| `intel_ingestion_batches` | 59 | **5 h** | `ofac` 01:00 + `scamsniffer` 01:30 | **actif** |
| `intel_canonical_entities` | **341 931** | **5 h** | idem | **actif** |

### Pipelines en attente de leur créneau — normal

| table | dernier écrit | cron | lecture |
|---|---|---|---|
| `MmScanRun` | 22 h | `mm-batch-scan` 09:00 | créneau non encore atteint (il est 06:43) |
| `FounderIntelIngestRun` | 24 h | `intel-rss` 07:00 | créneau dans ~17 min |

Ces deux-là ne sont **pas** en défaut : leur cadence quotidienne explique l'écart.

### Pipelines morts — cron déclaré, production arrêtée

| table | lignes | dernier écrit | cron déclaré | catégorie |
|---|---|---|---|---|
| **`ShillCorrelationCandidate`** | 1 532 | **2 158 h ≈ 90 j** | `shill-shadow` 07:00, **quotidien** | **`PIPE_NOT_CONNECTED`** |
| **`ShillBuyerObservation`** | 2 169 | **2 159 h ≈ 90 j** | `shill-shadow` 07:00, **quotidien** | **`PIPE_NOT_CONNECTED`** |

Un cron quotidien dont la table cible n'a pas bougé depuis 90 jours n'est pas un
`DATA_ABSENT` : la donnée a existé, la production s'est arrêtée.

### Le cas à ne pas trancher trop vite

| table | lignes | dernier écrit | cron | catégorie |
|---|---|---|---|---|
| `ShillEvent` | 235 | **21 h** | `shill-feed`, **horaire** | **`NOT_MEASURABLE`** |

Le cron est **horaire** et la table n'a rien reçu depuis 21 heures — soit 21
passages sans écriture. Mais `shill-feed` ne journalise pas dans `JobRunLog`, et
un collecteur qui ne trouve rien n'écrit rien légitimement.

**Je ne peux pas distinguer « 21 passages à vide » de « 21 passages qui n'ont pas
eu lieu ».** C'est `NOT_MEASURABLE` en l'état, et ça le restera tant que ce cron
n'écrira pas de trace d'exécution. Ce qui est mesurable et que je consigne : **21
heures sans production sur une cadence horaire.**

### Trois crons dont la table cible est VIDE

| cron | écrit vers | lignes | catégorie |
|---|---|---|---|
| `watch-rescan` 08:00 | `WatchAlert` · `WatchedAddress` | **0** · 1 (il y a 11 j) | **`PIPE_NOT_CONNECTED`** |
| `watch-alerts` 08:00 | — (délègue, pas d'écriture Prisma directe) | `WatchAlert` = **0** | **`PIPE_NOT_CONNECTED`** |
| `process-events` 03:00 | — (délègue) | `onchain_events` = **0** | voir ci-dessous |

`watch-rescan` écrit explicitement `watchAlert` (vérifié dans la route) et la
table n'a **jamais reçu une ligne**. `WatchedAddress` en porte **une seule**,
écrite il y a 11 jours. Le cron est déclaré depuis longtemps ; sa sortie est nulle.

> **Nuance sur `process-events`** : `onchain_events` est vide, mais `DomainEvent`
> a été écrit **il y a 3 heures**. Le cron produit donc quelque part — la table
> `onchain_events` est probablement un vestige, pas sa cible. **Je ne le classe
> pas** faute d'avoir tracé l'écriture jusqu'à sa destination : c'est du ressort
> de la moitié CODE de la carte.

## Les 55 tables vides

Parmi elles, plusieurs portent des noms de fonctionnalités annoncées :
`WatchScan`, `WatchAlert`, `onchain_events`, `signals`, `alert_deliveries`,
`alert_subscriptions`, `IngestionBatch`, `IngestionJob`, `RawDocument`,
`ContradictionAlert`, `Retraction`, `ScoreSnapshot`, `TransparencySubmission`,
`CommunitySubmission`, `WaitlistEntry`, `casefiles`, `VaultCaseFile`…

**Je ne les classe pas une par une** : une table vide peut être un collecteur
manquant, une fonctionnalité jamais lancée, ou un vestige de schéma. Distinguer
les trois demande de savoir si un écrivain existe dans le code — c'est la moitié
que T2 instruit. Je livre la liste et la volumétrie ; la catégorisation
définitive appartient à la convergence.

## Les tables dormantes qui portent des données servies

Point important pour un lecteur Investor/Counsel : **plusieurs tables qui
alimentent les surfaces publiques n'ont plus été écrites depuis des mois.**

| table | lignes | dernier écrit | ce qu'elle alimente |
|---|---|---|---|
| `KolProfile` | 412 | **11 j** | les 32 profils publiés |
| `KolWallet` | 482 | **82 j** | les 164 wallets servis |
| `KolEvidence` | 80 | **115 j** | `evidences` / `evidenceCount` |
| `KolCase` | 11 | **136 j** | `caseLinks` |
| `KolTokenLink` | 292 | **23 j** | liens KOL ↔ token |
| `TokenPriceTracker` | 340 | **115 j** | suivi de prix |
| `KolProceedsSummary` | 28 | **135 j** | agrégats de proceeds |

**`KolWallet` n'a pas reçu d'écriture depuis 82 jours** alors que c'est la table
dont dépendent les 164 adresses servies et tout le calcul d'attribution.
**`KolEvidence` : 115 jours.** Les surfaces servent donc un corpus figé.

Ce n'est pas un défaut de lecture — S1 a montré que la sortie correspond
exactement à la base. C'est un **constat de fraîcheur** : ce qui est servi est
exact et vieux.

## Bilan S3

| catégorie | objets |
|---|---|
| `PIPE_NOT_CONNECTED` | `shill-shadow` (2 tables, 90 j) · `watch-rescan` / `watch-alerts` (`WatchAlert` à 0) |
| `NOT_MEASURABLE` | l'exécution de **15 crons sur 17** · `shill-feed` (21 h sur cadence horaire) |
| actifs vérifiés | 7 pipelines écrivant dans les 5 dernières heures |
| non classé, renvoyé à la convergence | 55 tables vides · `process-events` |

**Constat de méthode** : sans trace d'exécution, l'état d'un collecteur n'est pas
mesurable depuis la base — seulement sa **production**. Deux crons sur dix-sept
journalisent. C'est le premier trou à combler si l'on veut pouvoir répondre
« pourquoi » plutôt que « il n'y a rien ».

---

# S4 · Les PDF publics — ce qu'un lecteur Investor/Counsel reçoit vraiment

Trois documents mesurés sur leur **texte extrait** par `pdftotext`, jamais sur le
flux : BOTIFY (EN et FR) et VINE (EN). Neuf pages chacun.

| document | PDF | texte extrait | sections retirées |
|---|---|---|---|
| BOTIFY EN | 112 338 o | 5 694 o | **3** |
| BOTIFY FR | 114 841 o | 6 418 o | **3** |
| VINE EN | 104 414 o | 5 044 o | **5** |

## Section par section

| section | BOTIFY | VINE |
|---|---|---|
| **TigerScore** | « — · Not established » | « — · Not established » |
| **Executive Summary** | **peuplée** — contenu substantiel | **avertissement seul** |
| **Evidence Index** | présente, **8 items retirés** | présente, **8 items retirés** |
| **On-chain Timeline** | **retirée** | **retirée** |
| **Token Control** | **peuplée** | **retirée** |
| **Launch Metrics** | **peuplée** | **retirée** |
| **Wallet Cluster Summary** | **retirée** | **retirée** |
| **Related Projects** | **retirée** | **retirée** |
| **OSINT Catalog** | présente, **vide** | présente, **vide** |

## Le renderer agnostique se comporte correctement

C'est le point à porter au crédit du dispositif : **VINE ne reçoit pas les
données de BOTIFY**. Là où VINE n'a rien, la section est **retirée** — pas
remplie avec le contenu du dossier voisin, pas laissée blanche non plus. `Token
Control` et `Launch Metrics` sont peuplées chez BOTIFY et retirées chez VINE,
exactement comme la base le commande.

**Aucun contenu fabriqué pour combler un vide.**

## Le TigerScore — absent et déclaré comme tel

Les deux documents rendent :

```
—
Not established
TIGERSCORE
Structural-risk composite score
```

Un score absent est rendu **« Not established »**, jamais `0`, jamais `X/100`.
C'est le comportement attendu de BUILD 9, mesuré ici sur la surface finale.

**Catégorie : `DATA_ABSENT`, signalé.** Pas un blanc silencieux.

## Le catalogue OSINT est vide, et la base explique pourquoi

Les deux documents portent, à l'identique :

> *No catalogued artefact currently carries the integrity, origin and capture
> timestamp required for publication. The artefacts remain attached to the file.*

**C'est la conséquence directe et mesurée de S2.** BOTIFY porte 8 lignes dans
`CaseFileSource`, mais avec `sourceUrl` **0/8**, `sha256` **0/8**, `snapshotId`
**0/8**. Aucune ne satisfait l'exigence d'intégrité et d'origine — donc aucune ne
se publie. VINE, lui, n'a **aucune** ligne source du tout.

La chaîne est complète et vérifiée de bout en bout :

```
sha256 / sourceUrl absents en base   →   aucun artefact publiable   →   catalogue OSINT vide au PDF
```

**Catégorie : `DATA_ABSENT`** (les trois champs), avec un effet de surface
**signalé**.

## La tension à consigner — sans la trancher

Le PDF BOTIFY affirme, dans son résumé exécutif :

> *No referenced claim in this file currently meets the publication
> requirements.*

et, **quatre lignes plus bas** :

> *Mint and freeze authority remain active, allowing the deployer to alter supply
> or block holders at will (source: rugcheck.xyz).*
> *Top-3 holder concentration reached 62% at peak, with 78% top-10 (source:
> Solscan holder queries).*

Ces deux affirmations sont **sourcées inline** et ne proviennent pas du corpus de
claims — elles viennent du contenu statique du gabarit. Le document dit donc
simultanément « aucun claim référencé n'est publiable » et énonce des constats
chiffrés attribués à des sources nommées.

Ce n'est **pas** une contradiction formelle : les claims du corpus et le texte du
gabarit sont deux choses différentes, et le document ne prétend pas que les
seconds sont des claims. Mais **un lecteur Counsel ne fait pas cette
distinction** : il lit un rapport qui se déclare sans preuve publiable et qui
avance des chiffres.

Même observation pour `Token Control`, peuplée depuis `rugcheck.xyz` sans passer
par le registre de sources.

**Je ne classe pas** : c'est une question de doctrine éditoriale, pas un défaut
de donnée. Je la consigne parce qu'elle est visible sur la surface la plus
exposée du produit.

## Ce que reçoit concrètement un lecteur

**BOTIFY** : un score non établi, un résumé avec deux constats sourcés hors
corpus, les autorités du token, des métriques de lancement, **8 claims retirés**,
un catalogue OSINT vide, et 3 sections retirées.

**VINE** : un score non établi, un résumé réduit à son avertissement, **8 claims
retirés**, un catalogue OSINT vide, et **5 sections retirées sur 7**. Le document
fait 9 pages et n'affirme presque rien.

**Aucun des deux n'affirme quoi que ce soit de faux.** C'est un rapport de
complétude, pas d'exactitude — et sur ce plan, les deux documents sont honnêtes :
chaque vide est nommé.

## Bilan S4

| catégorie | objets |
|---|---|
| `DATA_ABSENT` **signalé** | TigerScore (2 dossiers) · catalogue OSINT (2) · 3 sections BOTIFY · 5 sections VINE |
| `BUG` | **0** |
| blancs silencieux | **0** — chaque section vide porte son motif |
| non classé | la tension « aucun claim publiable » vs constats sourcés du gabarit |

**Aucune fuite croisée, aucun contenu fabriqué, aucun blanc muet.** Le défaut
n'est pas dans le rendu : il est en amont, dans un corpus dont la preuve n'a ni
empreinte ni origine.

---

# S5 · `/api/casefile` champ par champ — et un blanc qui rassure

Comparaison des deux dossiers sur **39 chemins de champ** de la réponse JSON.

## Champs vides sur les DEUX dossiers

| champ | BOTIFY | VINE | catégorie |
|---|---|---|---|
| `off_chain.tiger_score` | `null` | `null` | `DATA_ABSENT` signalé (rendu « Not established » au PDF) |
| `on_chain.asset.mintAuthority` | `null` | `null` | voir ci-dessous |
| **`on_chain.distribution.top_holders`** | **`[]`** | **`[]`** | voir ci-dessous |
| **`on_chain.distribution.top10_pct`** | **`null`** | **`null`** | voir ci-dessous |
| **`on_chain.distribution.concentration_flags`** | **`[]`** | **`[]`** | voir ci-dessous |

## Champs qui diffèrent

| champ | BOTIFY | VINE | lecture |
|---|---|---|---|
| `off_chain.sources` | **`[8]`** | **`[]`** | conforme à S2 — VINE n'a aucune ligne `CaseFileSource` |
| `on_chain.flows.notable_wallets` | **`[]`** | **`[4]`** | **attendu et documenté** |

`notable_wallets` vide sur BOTIFY est **explicitement attendu** : le commentaire
de la route indique que ces adresses viennent désormais de
`token_casefiles."keyWallets"`, que BOTIFY n'en porte aucun, et qu'en fabriquer
pour remplir la forme serait le défaut qu'on ferme. **`DATA_ABSENT`, intentionnel
et documenté.**

Ce qui fonctionne par ailleurs : `on_chain.markets` est **entièrement peuplé** sur
les deux dossiers — `dex`, `price_usd`, `liquidity_usd`, `volume_24h_usd`,
`fdv_usd`, `primary_pool`. Une source externe répond donc bien.

## Le blanc silencieux — `distribution`

C'est le seul **blanc muet** trouvé sur l'ensemble de la reconnaissance, et il
porte sur un signal de risque.

`fetchHolders` interroge le RPC Solana public et **avale toute erreur** :

```ts
async function fetchHolders(mint) {
  try {
    const r = await fetch("https://api.mainnet-beta.solana.com", { …,
      signal: AbortSignal.timeout(6000) });
    …
    if (!holders.length) return null;
    …
  } catch { return null; }        // ← toute cause, sans trace
}
```

Puis, en aval :

```ts
const top10 = parseFloat(holders?.top10_pct ?? "0");   // null  →  0
if (top10 > 50) concentrationFlags.push("high_top10_concentration");
if (top10 > 70) concentrationFlags.push("extreme_concentration");
```

**Conséquence mesurée.** Quand la lecture des porteurs échoue — timeout de 6 s,
RPC public saturé, erreur réseau, réponse vide — la réponse rend :

```json
"distribution": { "top_holders": [], "top10_pct": null, "concentration_flags": [] }
```

Aucun champ d'erreur, aucun marqueur d'indisponibilité. **Un échec de lecture et
un jeton sans concentration produisent exactement la même sortie.**

Et le défaut penche du mauvais côté : `top10` retombe à `0`, donc **aucun
drapeau de concentration n'est levé**. `concentration_flags: []` se lit
« aucun problème de concentration détecté ». Une panne muette produit un signal
rassurant.

> **Je n'ai pas testé le RPC.** Le mandat interdit tout appel RPC. Je ne peux donc
> pas dire si `api.mainnet-beta.solana.com` répond en ce moment — seulement que
> le bloc est vide sur les deux dossiers, que `markets` est peuplé (donc le
> réseau sortant fonctionne), et que **le code ne permet pas de distinguer les
> deux causes**.

| objet | catégorie |
|---|---|
| `distribution.top_holders` · `top10_pct` · `concentration_flags` | **`BUG`** — blanc silencieux sur un signal de risque, orienté vers la réassurance |

C'est le seul champ de toute la reconnaissance que je classe en `BUG`.

## Et la tension de S4 devient concrète

Le PDF BOTIFY affirme :

> *Top-3 holder concentration reached 62% at peak, with 78% top-10 (source:
> Solscan holder queries).*

alors que **la lecture vivante des porteurs, sur la même surface produit, rend un
bloc vide**. Le chiffre publié vient du gabarit statique ; le lecteur live ne le
porte pas et ne le confirme pas.

Ce n'est pas une contradiction — le PDF cite explicitement Solscan et un « pic »
passé, pas une mesure du jour. Mais **le produit publie une concentration de
62 %/78 % et, dans le même temps, son propre lecteur de concentration ne rend
rien.** À verser au dossier de doctrine ouvert en S4.

---

# S6 · Surfaces non mesurées

| surface | raison | catégorie |
|---|---|---|
| `/en/cases/lab` · `/fr/cases/lab` · pages KOL | **gate beta `/access`** — redirection vers un formulaire de code NDA. Aucun code saisi. | **`NOT_MEASURABLE`** |
| `/api/casefile/generate` | exige un `POST`. Mandat en lecture seule. | **`NOT_MEASURABLE`** |
| exécution de 15 crons sur 17 | aucune trace dans `JobRunLog` | **`NOT_MEASURABLE`** |
| disponibilité du RPC Solana public | tout appel RPC interdit par le mandat | **`NOT_MEASURABLE`** |
| 55 tables vides | distinguer collecteur manquant / feature jamais lancée / vestige demande de savoir si un écrivain existe — moitié CODE | renvoyé à la convergence |

**Ces surfaces sont non mesurées, pas vides.** La distinction est le point de la
consigne, et je m'y tiens : je n'ai pas de mesure, donc je n'ai pas de verdict.

---

# SYNTHÈSE

## Décompte par catégorie

| catégorie | nombre | où |
|---|---|---|
| `DATA_ABSENT` | **~40 champs** | 9 scalaires KOL + 2 relations KOL · `evidenceRefs` VINE · `claimDate`/`actors`/`threadUrl` BOTIFY · `CaseFileSource` VINE · `sourceUrl`/`sha256`/`snapshotId` BOTIFY · tigerScore ×2 · catalogue OSINT ×2 · 8 sections PDF · `notable_wallets` BOTIFY |
| `INTENTIONALLY_NOT_SHOWN` | **~23** | 6 montants retirés (2 256 175 $) · 16 profils sans wallet publiable · `builtFromEventId` |
| `PIPE_NOT_CONNECTED` | **9** | `CaseFileShiller` · `CaseFileSmokingGun` · 5 colonnes de `CaseFileClaim` · `shill-shadow` (2 tables, 90 j) · `watch-rescan`/`watch-alerts` (`WatchAlert` à 0) |
| `COLLECTOR_MISSING` | **2** | écrivain de claims CaseFile · écrivain de sources CaseFile |
| `NOT_MEASURABLE` | **5 surfaces** | UI derrière `/access` · `/generate` · exécution de 15 crons · RPC Solana · `shill-feed` |
| **`BUG`** | **1** | **`on_chain.distribution` — blanc silencieux orienté réassurance** |
| sans catégorie | 1 | `C13` — n'a jamais existé |

## La liste des blancs silencieux

Un **blanc silencieux** est un vide qui ne dit pas pourquoi il est vide. Sur
l'ensemble des surfaces mesurées, il y en a **un seul** :

| # | champ | pourquoi il est silencieux |
|---|---|---|
| **1** | `on_chain.distribution` (`top_holders`, `top10_pct`, `concentration_flags`) | `fetchHolders` avale l'erreur, `top10` retombe à `0`, aucun drapeau n'est levé. Panne et absence de risque sont indistinguables, et la sortie penche vers la réassurance. |

**Tout le reste est nommé.** Les montants retirés portent `proceedsPublication:
"withdrawn"`. Les sections PDF retirées portent leur motif et leur champ. Le
TigerScore absent rend « Not established ». Le catalogue OSINT vide explique
qu'aucun artefact ne satisfait l'exigence d'intégrité. C'est un résultat
remarquable pour un produit à ce stade, et il faut le dire aussi clairement que
le défaut.

## L'état des collecteurs, en une ligne chacun

| collecteur | état |
|---|---|
| `helius-scan` 04:00 | **actif** — `KolProceedsEvent` écrit il y a 3 h |
| `watcher-v2` 06:00 | **actif** — `WatcherCampaign` il y a 1 h |
| `daily-flow` 02:00 | **actif** — `social_post_candidates` il y a 1 h |
| `ofac` 01:00 + `scamsniffer` 01:30 | **actifs** — 341 931 entités canoniques, il y a 5 h |
| `weekly-digest` lun 08:00 | **actif** — `WatcherDigest` il y a 1 h |
| `process-events` 03:00 | **produit** (`DomainEvent` il y a 3 h) — destination exacte non tracée |
| `mm-batch-scan` 09:00 | **en attente de créneau** — normal |
| `intel-rss` 07:00 + `intel-summarize` 07:30 | **en attente de créneau** — normal |
| `watcher-bridge` 06:30 | **armé, désactivé** — `disabled` 270 fois sur 281 |
| `shill-feed` horaire | **21 h sans production** — exécution non traçable |
| `shill-shadow` 07:00 | **mort** — 90 jours sans écriture |
| `watch-rescan` 08:00 | **mort** — `WatchAlert` n'a jamais reçu une ligne |
| `watch-alerts` 08:00 | **mort** — même table à 0 |
| `retail-process-queue` 05:00 · `reaper` 02:30 | **non traçables** — aucune trace, destination inconnue |

**7 actifs · 2 en attente · 1 désactivé · 3 morts · 4 non traçables.**

## Les trois faits qui comptent pour un lecteur Investor/Counsel

1. **Ce qui est servi est exact et vieux.** Aucun écart entre base et sortie sur
   la surface KOL. Mais `KolWallet` n'a pas été écrit depuis **82 jours**,
   `KolEvidence` depuis **115**, `KolCase` depuis **136**. Le produit sert
   fidèlement un corpus figé.

2. **La preuve n'est pas opposable.** Les 8 sources de BOTIFY n'ont ni URL, ni
   empreinte, ni snapshot — c'est mesuré, et c'est exactement pourquoi le
   catalogue OSINT du PDF est vide. VINE n'a aucune source du tout, et **aucun
   écrivain applicatif n'existe pour lui en créer**.

3. **Un seul vide ment par omission**, et c'est un signal de risque :
   `concentration_flags: []` ne distingue pas « pas de concentration » de « je
   n'ai pas pu regarder ».

## Ce que je n'ai pas fait, et qui reste ouvert

- Aucune classification des **55 tables vides** — elle demande la moitié CODE.
- Aucune mesure de l'**UI** — la gate `/access` tient, et je n'ai saisi aucun code.
- Aucun appel **RPC** ni **POST**, conformément au mandat.
- `main` **figé**, aucun déploiement, aucun merge.

---

# S7 · Les surfaces de liste — trois comptes différents pour un même corpus

Ajouté après la synthèse : trois routes listent les KOL publiés et **ne rendent
pas le même nombre**.

| route | rend | filtre appliqué |
|---|---|---|
| `/api/kol/leaderboard` | **32 profils** | `PUBLIC_KOL_FILTER` seul |
| `/api/kol` | **18 profils** | `PUBLIC_KOL_FILTER` **+ `riskFlag: { not: 'unverified' }`** |
| `/api/v1/kol` | **20 résultats** | `PUBLIC_KOL_FILTER` + `take: limit` (**défaut 20**) |

## L'écart s'explique entièrement, et l'arithmétique ferme

`/api/kol` applique un filtre supplémentaire que les deux autres n'ont pas.
Mesuré en base sur les 32 publiés :

| `riskFlag` | profils |
|---|---|
| **`unverified`** | **14** |
| `confirmed_scammer` | 3 |
| `high` | 3 |
| `flagged` · `confirmed_rug` · `confirmed` | 2 chacun |
| `confirmed_scheme` · `under_investigation` · `paid-promo` · `promoter` · `victim_pool` · `high_risk` | 1 chacun |

**32 − 14 = 18.** Le compte est exact.

`/api/v1/kol` rend 20 par **pagination** (`limit` par défaut à 20, plafonné à
100), pas par filtrage. Ce n'est pas une perte : c'est une page.

| objet | catégorie |
|---|---|
| les 14 profils absents de `/api/kol` | **`INTENTIONALLY_NOT_SHOWN`** — filtre explicite, mais **incohérent entre surfaces** |
| les 12 derniers de `/api/v1/kol` | pagination — aucune catégorie |

**Ce que je consigne** : un consommateur qui interroge `/api/kol` voit 18 profils,
celui qui interroge `/api/kol/leaderboard` en voit 32. Les deux sont des surfaces
publiques du même corpus. Aucune des deux ne dit qu'elle filtre. **Le filtre est
intentionnel ; son inconsistance entre surfaces ne l'est probablement pas** — mais
c'est un arbitrage, pas une mesure, et je ne le tranche pas.

## Le vocabulaire de `riskFlag` est fragmenté

**12 valeurs distinctes pour 32 profils.** Plusieurs se recouvrent visiblement :

- `high` (3) et `high_risk` (1)
- `confirmed` (2), `confirmed_scammer` (3), `confirmed_rug` (2),
  `confirmed_scheme` (1)
- `promoter` (1) et `paid-promo` (1)

Ce n'est pas un vide, donc **aucune catégorie BUILD 10 ne s'applique**. Je le
signale parce que le filtre de `/api/kol` s'appuie sur une **égalité de chaîne**
(`not: 'unverified'`) : tout futur libellé mal orthographié passerait le filtre
sans que personne ne le remarque.

---

# S8 · Un corpus de 341 931 lignes que rien ne sert

| table | lignes | dernier écrit | lu par une route API ? |
|---|---|---|---|
| **`intel_canonical_entities`** | **341 931** | **il y a 5 h** (aujourd'hui 03:xx) | **NON** |

Recherche dans `src/app/` — l'intégralité des routes : **aucune occurrence** de
`intel_canonical_entities` ni de `intelCanonicalEntity`. Les seuls fichiers qui
la nomment sont :

```
src/lib/intelligence/ingest.ts        ← l'écrivain
src/lib/intelligence/reaper.ts        ← le nettoyeur
src/lib/data-nature/registry.ts       ← la déclaration de nature
src/lib/intelligence/__tests__/…      ← un test
```

**Un écrivain, un nettoyeur, aucun lecteur de surface.**

Les crons `ofac` (01:00) et `scamsniffer` (01:30) tournent, ont tourné il y a 5
heures, et alimentent fidèlement une table de **341 931 entités canoniques** —
le plus gros volume de toute la base — qu'**aucune surface publique n'expose**.

| objet | catégorie |
|---|---|
| `intel_canonical_entities` | **`PIPE_NOT_CONNECTED`** — à la plus grande échelle mesurée |

> **Réserve de méthode** : je n'ai cherché que dans `src/app/`. Une route pourrait
> l'atteindre par une fonction de `src/lib/` que je n'ai pas remontée — c'est
> précisément la chaîne que T2 instruit côté CODE. Ce que j'affirme est exact et
> borné : **aucune route ne nomme cette table**. La confirmation définitive
> appartient à la convergence.

---

# ADDENDA À LA SYNTHÈSE

Les deux surfaces mesurées après coup modifient le décompte :

| catégorie | ajout |
|---|---|
| `PIPE_NOT_CONNECTED` | **+1** — `intel_canonical_entities` (341 931 lignes) → **10 au total** |
| `INTENTIONALLY_NOT_SHOWN` | **+14** — les profils `unverified` absents de `/api/kol` |

**Le nombre de blancs silencieux reste à 1** : les trois surfaces de liste rendent
des comptes différents, mais chacune rend un corpus cohérent avec son propre
filtre. Aucune ne prétend être exhaustive. Ce n'est pas un blanc muet, c'est une
incohérence de contrat entre surfaces.

## Ce qui frappe, au terme de la reconnaissance

Le produit ne ment pas. Sur toutes les surfaces mesurées, **un seul vide ne dit
pas pourquoi il est vide**, et c'est `distribution`.

Le problème n'est pas l'honnêteté — elle est bonne, et par endroits remarquable :
un retrait signalé sur la même réponse, un catalogue vide qui explique son vide,
un renderer qui retire une section plutôt que d'emprunter celle du voisin.

Le problème est ailleurs, et il est double :

1. **Ce qui alimente n'alimente plus.** Trois collecteurs morts, un désactivé,
   quatre non traçables, et les tables du corpus KOL figées depuis 82 à 136
   jours.
2. **Ce qui est collecté n'est pas servi.** 341 931 entités écrites chaque nuit
   et lues par personne ; 10 lignes de shillers et de smoking gun sans lecteur ;
   cinq colonnes de claim déclarées et jamais écrites.

**Aucun de ces deux problèmes ne se voit depuis une surface publique.** C'est
pour cela qu'il fallait mesurer la base.

---

# S9 · Les quatre constats du watchdog du 2026-09-07, instruits

Mesures faites le **2026-09-08 entre 07:00 et 07:15 UTC**. Aucun cron relancé,
aucun drainage, TSA non activée.

## 9.1 — Source réglementaire « périmée » : **le chiffre est exact, sa lecture est fausse**

Le watchdog rapporte *« OFAC à 13 jours pour un seuil de 7 »* et en conclut que
*« les verdicts "pas de sanction" ne sont plus fiables »*. **Les 13 jours sont
confirmés. La conclusion ne l'est pas.**

### Le collecteur tourne, et il tourne bien

`intel_ingestion_batches`, slug `ofac` — les 12 derniers runs :

| début | statut | `recordsFetched` | `recordsNew` | `recordsUpdated` | déclencheur |
|---|---|---|---|---|---|
| 2026-09-08 01:00:40 | **`success`** | **874** | `null` | `null` | `admin:cron` |
| 2026-09-07 01:00:09 | `success` | 874 | `null` | `null` | `admin:cron` |
| … 10 runs identiques, du 2026-08-28 au 2026-09-06 … | | | | | |

**28 runs au total, 26 en `success`.** Le cron de 01:00 a tourné **ce matin**, il
y a moins de 7 heures, et a récupéré **874 enregistrements**. Le collecteur n'est
ni arrêté, ni ralenti.

### D'où viennent alors les 13 jours

De `intel_canonical_entities.lastSeenAt` :

| `strongestSource` | entités | actives | `max(lastSeenAt)` | âge |
|---|---|---|---|---|
| `scamsniffer` | 341 060 | 341 060 | 2026-09-08 01:30 | **0,2 j** |
| **`ofac`** | **869** | **869** | **2026-08-26 01:01** | **13,3 j** |
| `forta` | 1 | 1 | 2026-04-08 18:58 | **152,5 j** |
| `admin-manual` | 1 | 0 | 2026-08-26 04:50 | 13,1 j |

Les 13,3 jours du watchdog sont **exacts**. Mais ce champ ne mesure pas ce que le
watchdog lui fait dire — et **le code le déclare explicitement**.

### Le code avait déjà nommé ce piège

`src/lib/intelligence/ingest.ts`, lignes 20-38, en tête de fichier :

> *« `intel_canonical_entities.lastSeenAt`, `.updatedAt` et
> `intel_source_observations.lastVerifiedAt` sont désormais des champs LEGACY au
> sens suivant : ils ne prouvent PAS qu'une entité a été revue lors du dernier
> cycle. Depuis la garde `IS DISTINCT FROM` posée sur les deux
> `ON CONFLICT DO UPDATE` de `bulkUpsert`, une ligne dont rien n'a changé n'est
> plus réécrite — donc ces trois horodatages ne bougent plus. **Ils datent le
> dernier CHANGEMENT, pas la dernière observation.** »*

et la doctrine actée, deux lignes plus bas :

> *« dernière confirmation PAR ENTITÉ → **NON GARANTIE aujourd'hui**. Dit
> explicitement pour qu'**aucune sonde ne s'y adosse et ne produise un faux
> positif** — cf. `reaper.ts:70`, qui avait déjà REJETÉ ces trois champs comme
> sondes. »*

**Le watchdog est exactement la sonde que ce commentaire anticipait.** La garde
`IS DISTINCT FROM` a été posée pour supprimer ~340 000 `UPDATE` inutiles par
cycle ScamSniffer ; son effet de bord est que `lastSeenAt` gèle sur une liste
stable — et une liste de sanctions **est** stable.

C'est pourquoi ScamSniffer paraît frais (341 060 lignes, du contenu qui bouge
tous les jours) et OFAC paraît périmé (869 lignes qui ne changent pas).

### Ce qui reste vrai, et qui est le vrai risque

`IS DISTINCT FROM` ne garde que l'`UPDATE`, **pas l'`INSERT`** : une **nouvelle**
adresse sanctionnée serait donc insérée normalement. La liste servie n'est pas
périmée en contenu.

Mais deux choses restent mesurées et non résolues :

1. **`recordsNew` et `recordsUpdated` valent `null` sur tous les runs récents.**
   Le code l'assume (`« NULL = inconnu sur le chemin bulk »`), mais la
   conséquence est qu'**aucun run ne peut prouver qu'il a écrit quelque chose**.
   Le `success` du batch atteste la récupération des 874 enregistrements, pas
   leur intégration.
2. **La dernière confirmation par entité n'est pas garantie**, le code le dit.
   On ne peut donc pas répondre à « cette adresse était-elle encore sur la liste
   ce matin ? ».

### Où le floor est appliqué, et l'absence de contrôle de date — confirmée

`src/lib/tigerscore/engine.ts` :

```
:187   evm_known_bad — CRITICAL floor: wins over any other signal
:528   const intel = computeFromSignal(signal, base.score)
:545   "Address matched in regulatory sanctions list — floor 15 applied"
```

Recherche de `lastSeenAt|freshness|staleness|maxAge|ageDays|isStale` dans tout
`engine.ts` : **aucune occurrence**. **Il n'existe aucun contrôle de fraîcheur
sur ce chemin.**

Le moteur distingue en revanche **deux** états, et il le fait bien :

| situation | comportement mesuré |
|---|---|
| consultation **échoue** (exception) | recalcul avec `intelligence_lookup_failed`, confiance abaissée à « Low », source manquante nommée dans `dataQuality`, `unevaluatedSignals` reçoit `sanctions_floor`. Le score **n'est pas gonflé** |
| consultation **réussit sur une liste ancienne** | **indistinguable** d'une consultation sur une liste fraîche |

Le premier cas est traité avec soin — le commentaire `:566` explique que, avant,
une panne de la base de sanctions était servie comme une adresse propre. Le
second cas **n'existe pas dans le modèle du moteur**.

### Combien de verdicts publiés en dépendent

| surface | dépendance |
|---|---|
| `token_casefiles` avec `tigerScore` non nul | **2** — LAB (91, `published`) et BLACKBULL (0, `draft`) |
| `ScoreSnapshot` (verdicts historisés) | **0 ligne** |
| BOTIFY · VINE | `tigerScore` **`null`** |

**Aucun verdict persisté ne dépend aujourd'hui d'un match de sanction.** Le seul
score publié — LAB, 91 — est une valeur stockée sur un dossier BNB Chain, pas le
produit d'une consultation OFAC au moment de la lecture.

En revanche, **tout scan en direct** (`/api/scan/solana`, `/api/scan/evm`,
`/api/v1/score`) passe par le chemin du floor, sur **868 entités `SANCTION`**
actives. Ces réponses ne sont pas des verdicts publiés : elles sont produites à
la demande, une par requête, et non historisées (`ScoreSnapshot` est vide).

### Ce que le produit affiche quand la liste est ancienne

**Rien.** Aucune surface n'expose la fraîcheur d'une source de renseignement :
aucune route de `src/app/` ne nomme `intel_canonical_entities` (établi en S8).
Un lecteur reçoit un verdict sans date de liste, sans compteur d'entités, sans
mention de cycle.

Il ne reçoit pas non plus un « pas de sanction » explicite : l'absence de match
se traduit par l'**absence du driver** `intelligence_overlay`, donc par un score
qui ne mentionne simplement pas les sanctions. **L'absence est muette, pas
affirmative** — ce qui est moins grave qu'un « pas de sanction » affirmé, mais
tout aussi peu datable.

### Classement

| objet | catégorie | justification |
|---|---|---|
| collecteur OFAC | **aucune** — il fonctionne | 26 runs `success` sur 28, dernier il y a 7 h, 874 enregistrements |
| `lastSeenAt` comme sonde de fraîcheur | **`NOT_MEASURABLE`** | le champ date le dernier changement, pas la dernière observation ; le code le déclare LEGACY |
| `recordsNew` / `recordsUpdated` à `null` | **`NOT_MEASURABLE`** | aucun run ne peut prouver qu'il a écrit |
| confirmation par entité | **`DATA_ABSENT`** | « NON GARANTIE aujourd'hui », acté dans le code |
| **absence de contrôle de fraîcheur dans `computeTigerScore`** | **`BUG`** | le moteur traite l'échec de consultation et ignore l'ancienneté ; une liste vieille et une liste fraîche produisent la même sortie, sans que rien ne le dise |
| fraîcheur des sources en surface | **`PIPE_NOT_CONNECTED`** | mesurée en base, exposée nulle part |

### Ce que je remonte à l'architecte

Le constat du watchdog est **à requalifier, pas à écarter**. Il désigne un vrai
trou — *« le moteur ne sait pas dater sa liste »* — mais par un chiffre qui ne
le prouve pas. Les 13 jours ne disent pas que la liste est vieille ; ils disent
que **personne ne sait quand elle a été confirmée**, ce qui est un constat plus
inquiétant et plus difficile à corriger.

Et le second effet mérite d'être nommé : **un correctif de performance a
désarmé une sonde de fraîcheur**, sans que la sonde en soit informée. Le
commentaire de `ingest.ts` avait prévu le faux positif ; le watchdog l'a produit
onze jours plus tard.
