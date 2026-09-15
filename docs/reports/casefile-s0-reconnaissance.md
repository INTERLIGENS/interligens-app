# CASEFILE — S0 reconnaissance

Branche `feat/cc-offline-155-casefile-recon`, depuis `main = a4cff7c`.
Lecture seule : 7 passes SELECT en `READ ONLY` + `ROLLBACK`, 0 Helius, 0 write,
0 DDL, 0 code.

---

## STATUS

**Il n'existe pas un CaseFile System. Il en existe deux, disjoints.**

Un univers vit en base (`token_casefiles`, `platform_casefiles`) et alimente les
pages `/en/cases`. Un autre vit en dur (presets TypeScript, JSON, `CASE_DB` en
ligne) et alimente `/api/casefile*` et tous les PDF. **Les deux ne partagent
aucune ligne** : `token_casefiles` ne contient ni BOTIFY ni VINE (0/0 mesuré).

Conséquence structurelle : **les dossiers qui sont en base n'ont pas de
générateur, et les dossiers qui ont un générateur ne sont pas en base.**

---

## REALITY MAP

### Les autorités concurrentes

| autorité | lignes | contenu | nature | consommateurs |
|---|---|---|---|---|
| `token_casefiles` | **2** | LAB (publié, 19 932 c.), BLACKBULL (draft, **0 c.**) | ✅ 4 colonnes | `/en/cases`, `/fr/cases`, `/en/cases/lab` |
| `platform_casefiles` | **1** | CBEX (publié, 8 863 c.) | ❌ aucune | `/en/cases`, `/en/cases/cbex` |
| `casefiles` | **0** | suivi de génération PDF (`pdfSha256`) | — | *(aucun — table vide)* |
| `CASE_DB` en ligne (`api/casefile/route.ts`) | 1 | BOTIFY, 8 claims | ❌ | `/api/casefile` |
| `data/cases/botify.json` | 1 | 8 claims + `detective_trade` | ❌ | `loadCaseByMint` → **8 routes** |
| `src/data/cases/botify.json` | 1 | 8 claims, **sans** `detective_trade` | ❌ | — |
| `presets.ts` `buildBotifyInput()` | 1 | **100 % codé en dur** | ❌ | `/api/casefile/generate`, `/pdf` |
| `presets.ts` `buildVineInput()` | 1 | depuis `vine-osint.json` | ❌ | idem |
| `VaultCase` | **1** | espace investigateur | ❌ | `/investigators/box/cases` |

### La chaîne, maillon par maillon

```
consumer                    resolver              authority            evidence      nature    renderer
──────────────────────────────────────────────────────────────────────────────────────────────────────
/en/cases                   ref (exact)           token_casefiles      —             partiel   HTML seul
/en/cases/lab               ref = IL-PND-LAB-001  token_casefiles      —             partiel   HTML seul
/en/cases/cbex              ref = IL-PON-CBEX-001 platform_casefiles   —             AUCUNE    HTML seul
/api/casefile               casefileLookupKey     CASE_DB en ligne     —             AUCUNE    JSON
/api/casefile/public        preset (handle|mint)  presets.ts (dur)     —             AUCUNE    PDF
/api/casefile/pdf           preset                presets.ts (dur)     —             AUCUNE    PDF
/api/report/v2              loadCaseByMint        data/cases/*.json    —             AUCUNE    PDF
/api/pdf/casefile           loadCaseByMint        data/cases/*.json    —             AUCUNE    PDF
/api/v1/score, partner ×3   loadCaseByMint        data/cases/*.json    —             AUCUNE    JSON
fiche KOL → « CASEFILE »    handle → preset       presets.ts (dur)     —             AUCUNE    PDF
```

**Aucune colonne ne relie un dossier à une preuve.** `EvidenceSnapshot`
`relationType='case'` porte 20 lignes, sur 5 clefs qui sont des **tickers
legacy** — `BOTIFY-MAIN`, `BOTIFY`, `GHOST`, `GHOST-RUG`, `SERIAL-12RUGS` —
jamais un `ref` de dossier ni un mint. `EvidenceItem` : **34 lignes sur 1 104
portent une provenance** (3,1 %).

### BOTIFY — ce que le preset affirme vs ce que la base porte

| | preset (codé en dur) | base (mint canonique) | écart |
|---|---|---|---|
| cashouts | **604 489 $** | **150 577 $** | **× 4,0** |
| KOL | 28 | 18 | −10 |
| événements | 295 | 262 | −33 |

Les **quatre wallets** que le preset nomme avec un montant chacun —
« EduRio 347 237 $ → MEXC », « MoneyLord 85 484 $ → Bybit », « ElonTrades
53 313 $ → MEXC », « GordonGekko 40 627 $ » — portent **0 ligne
`KolProceedsEvent` chacun**. Ces montants ne sont reproductibles depuis aucune
source du produit.

Trois de ces quatre adresses sont `isPubliclyUsable = false` : le PDF publie des
adresses que le gate de publiabilité livré en BUILD 8 refuse.

Le preset écrit aussi `followers: 0` pour cinq des six shillers, quand la base
porte 28 000 (GordonGekko), 190 188 (ElonTrades), 96 540 (Moneylord), 45 000
(bkokoski), 12 000 (planted). Un zéro codé en dur, présenté comme une donnée.

Et `@MoneyLord` (preset) vs `Moneylord` (base) — la même divergence de casse que
E1 vient de fermer côté KOL, rouverte ici.

### VINE — ce qui est reproductible aujourd'hui

**Rien.** `KolProceedsEvent` 0 · `KolTokenLink` 0 · `KolTokenInvolvement` 0 pour
le mint `6AJcP7wu…Rpump`. Le dossier existe intégralement dans
`src/data/vine-osint.json`, sans contrepartie en base.

Le fichier porte `claims: []` et `new_claims: [9]` — deux champs pour la même
chose, dont le renderer public ne lit que `claims` (`pdfGeneratorPublic.ts:501`
lit `botifyCase.claims`). VINE n'a donc **aucun claim rendu** par la voie
publique.

### Versioning / lifecycle

`TokenCaseFile` porte `status`, `statusNote`, `publishStatus`, `createdAt`,
`updatedAt`. **Ni version, ni `supersedes`, ni historique de révision.** Un
dossier corrigé écrase le précédent, et rien ne permet de dire ce qui était
publié à une date donnée.

`platform_casefiles` : idem, sans les colonnes de nature.

Aucune des deux tables ne porte de hash de contenu. `casefiles` porte
`pdfSha256` — et **0 ligne**.

### Renderer / export

- `pdfGenerator.ts` (363 l.) et `pdfGeneratorPublic.ts` (833 l.) lisent les
  **presets et JSON**, jamais les tables.
- `/en/cases/lab` et `/en/cases/cbex` rendent du **HTML seul** : les dossiers en
  base n'ont aucun chemin PDF.
- `CaseExport` : 1 ligne, `POLICE_ANNEX_PDF`, avec `contentHashSha256`,
  `publishabilityFilter`, `iocCount` — mais issue de `VaultCase`
  (investigateur), une lignée entièrement séparée des deux autres.

---

## P0 BLOCKERS

| # | constat | classe |
|---|---|---|
| **B1** | Deux univers disjoints : les dossiers en base n'ont pas de renderer, ceux qui ont un renderer ne sont pas en base. Aucun chemin ne mène de `token_casefiles` à un PDF. | `PIPE_NOT_CONNECTED` |
| **B2** | BOTIFY publie **604 489 $** quand la base en porte **150 577** — facteur 4. Les 4 montants par wallet ne sont adossés à aucune ligne. C'est du contenu retail publié, non reproductible. | `DATA_ABSENT` |
| **B3** | Le PDF public expose 3 adresses `isPubliclyUsable = false`, que le gate BUILD 8 refuse par ailleurs. Deux régimes de publication contradictoires sur la même donnée nominative. | `BUG` |
| **B4** | Aucun lien dossier ↔ preuve. `EvidenceSnapshot relationType='case'` s'indexe sur des tickers legacy, pas sur un `ref`. Un dossier ne peut pas citer sa preuve. | `PIPE_NOT_CONNECTED` |
| **B5** | Deux copies divergentes de `botify.json` — celle de `data/` porte `detective_trade`, celle de `src/data/` non. Le `loadCaseByMint` racine et le `@/lib` ne lisent pas le même fichier. | `BUG` |
| **B6** | Aucun versioning. Un dossier corrigé écrase le précédent ; impossible de dire ce qui était publié à une date. Bloquant pour Investigator / Counsel (build 13). | `DATA_ABSENT` |
| **B7** | VINE : 0 trace on-chain, `claims` vide, renderer lisant `claims` — le dossier VINE ne rend aucun claim par la voie publique. | `COLLECTOR_MISSING` |
| **B8** | `platform_casefiles` porte `confirmedLossUsd = 12 000 000` **sans aucune colonne de nature** — le seul montant à 8 chiffres du produit hors gouvernance Data Nature. | `PIPE_NOT_CONNECTED` |

---

## REUSABLE

Ce qui est solide et ne doit pas être réécrit :

- **`token_casefiles` comme schéma.** 49 colonnes, structure riche (famille,
  sous-type, verdict, chaînes, wallets, backers, sources horodatées), et
  **déjà 4 colonnes de nature** dont `insiderExitNotionalBasis` renseigné.
  C'est le seul candidat crédible au rôle d'autorité unique.
- **Le corpus `sources` de `token_casefiles`.** LAB porte 4 sources datées avec
  investigateur nommé ; BLACKBULL porte 7 appels RPC/API horodatés avec méthode
  et cible. C'est déjà de la provenance exploitable.
- **La chaîne Data Nature.** Registre, régimes, `decorate`, `writeGuard`,
  `methodRef` — livrée et éprouvée sur 5 602 lignes en BUILD 8.
- **`casefileLookupKey` / `assertCanonicalKeys`** (BUILD 8 / E2) : le contrat
  d'alias est en place et testé, réutilisable pour toute carte indexée par mint.
- **`CaseExport`** : `contentHashSha256` + `publishabilityFilter` +
  `privateExcluded`. Le modèle d'export gouverné existe déjà, côté vault.
- **Les deux générateurs PDF** (1 196 lignes) : la mise en page, les mentions
  légales et la structure retail sont faites. C'est leur **source** qui est en
  cause, pas leur rendu.
- **`EvidenceSnapshot`** : 1 159 lignes, `PRIMARY_OBSERVATION` déclarée, hash et
  artefact récupérable. La matière probante existe — elle n'est pas rattachée.

---

## MISSING

| manque | classe |
|---|---|
| Un **resolver de dossier unique** : aujourd'hui `ref`, mint, ticker, handle et preset coexistent sans arbitrage. | `PIPE_NOT_CONNECTED` |
| Le **rattachement dossier ↔ preuve** (clé de relation sur `ref`). | `PIPE_NOT_CONNECTED` |
| Un **renderer branché sur la base** — ou une migration des presets vers elle. | `PIPE_NOT_CONNECTED` |
| Le **versioning / lifecycle** (version, supersedes, hash de contenu). | `DATA_ABSENT` |
| Les **colonnes de nature sur `platform_casefiles`**. | `PIPE_NOT_CONNECTED` |
| BOTIFY et VINE **en base** — aujourd'hui ils n'existent qu'en dur. | `DATA_ABSENT` |
| Les **montants par wallet** de BOTIFY : aucune source ne les porte. | `NOT_MEASURABLE` |
| VINE **on-chain** : aucun collecteur n'a jamais tourné sur ce mint. | `COLLECTOR_MISSING` |
| `BLACKBULL` : `bodyMarkdown` vide, `status = DRAFT_TREASURY_PROBABLE`. | `INTENTIONALLY_NOT_SHOWN` |
| `casefiles` (suivi PDF) : table créée, jamais alimentée. | `PIPE_NOT_CONNECTED` |

---

## PROPOSED BUILD 9 BOUNDARY

### Dans le build

1. **Élire `token_casefiles` autorité unique** et y faire converger les
   consommateurs. C'est la seule table qui porte déjà nature et provenance.
2. **Un resolver de dossier unique** — `ref` canonique, mint/ticker/handle en
   alias explicites, sur le modèle du contrat d'alias déjà livré en E2.
3. **Rattacher la preuve** : une clé de relation sur `ref`, et la reprise des
   20 `EvidenceSnapshot` indexés sur des tickers legacy.
4. **Aligner le régime de publication** : le gate de publiabilité des wallets
   (BUILD 8 / P1) doit gouverner le PDF comme il gouverne l'API — B3 est une
   contradiction, pas une lacune.
5. **Nature sur `platform_casefiles`**, au moins sur `confirmedLossUsd` (B8).
6. **Versioning minimal** : version + hash de contenu, pour qu'un dossier publié
   reste citable après correction.
7. **Statuer sur les chiffres BOTIFY non reproductibles** — les adosser, ou les
   retirer de la publication comme le containment P0 l'a fait pour les proceeds.

### Hors du build

- Migrer BOTIFY/VINE en base **avant** que l'autorité et le resolver soient
  posés : ce serait déplacer le problème.
- Collecter le on-chain VINE (`COLLECTOR_MISSING` → relève de Data Completeness,
  build 10).
- Réécrire les générateurs PDF : leur rendu est bon, leur source ne l'est pas.
- Toucher `VaultCase` / `CaseExport` : lignée investigateur, relève du build 13.
- `BLACKBULL` : draft assumé, pas un trou.

### Le point qui décidera du build

**B1 est la question, pas B2.** Tant que les dossiers en base n'ont pas de
renderer et que les dossiers rendus n'ont pas de base, chaque correction de
contenu doit être faite deux fois — et l'une des deux sera oubliée. C'est déjà
arrivé : E2 a corrigé l'identité BOTIFY dans les cartes, et le preset continue
d'annoncer 604 489 $.

Aucun STOP : la frontière ci-dessus est une proposition, elle n'exige pas
d'arbitrage pour être lue.
