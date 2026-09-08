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
