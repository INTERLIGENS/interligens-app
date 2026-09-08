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
