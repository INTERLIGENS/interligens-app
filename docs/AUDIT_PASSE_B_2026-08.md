# INTERLIGENS — AUDIT PASSE B
## Fiabilité opérationnelle, résilience, risques de retrofit

**Date :** 2026-08-16 · **Machine :** Host-001 · **Mode :** READ-ONLY, aucune écriture, aucune migration
**Code audité :** `main` = `5bed649`. `git diff --stat 1178ab8 5bed649` = **1 fichier, `docs/CLOTURE_2026-08-16_phases-3-4.md`, +92 lignes**. Le code de `main` et celui de la production sont **identiques** [VÉRIFIÉ: git diff]
**Base :** `ep-square-band` (`neondb`, PostgreSQL 17.10), lecture seule, `SET default_transaction_read_only = on`
**Sondes production :** GET uniquement sur `https://app.interligens.com`

### Convention de temps

Le serveur Neon est en `TimeZone = GMT` et les colonnes `timestamp without time zone` contiennent bien de l'UTC : `DomainEvent.createdAt` (naïf) = `2026-08-16 04:26:26` et `KolProceedsEvent.createdAt` (aware) = `2026-08-16 04:25:11+00` pour le même run de cron. Toutes les dates de ce rapport sont en **UTC** [VÉRIFIÉ: `select now()::text, current_setting('TimeZone')` → `2026-08-16 14:44:43+00 | GMT`].

---

# A — RELIABILITY VERDICT

## `FRAGILE`

Le système n'est ni cassé ni improvisé. Il contient des morceaux d'ingénierie de qualité réelle : le pipeline `DomainEvent` a retry, backoff, dead-letter et alerte ; la file retail a un verrou optimiste, un budget et une classification d'erreur terminale ; le vault investigateur écrit son audit **avant** la suppression ; le gate nominatif est fail-closed sans branche `NODE_ENV`.

Il est classé `FRAGILE` — et non `ACCEPTABLE` — pour trois raisons qui se cumulent et qui sont toutes prouvées ci-dessous :

**1. Le produit publie aujourd'hui, en production, des chiffres nominatifs qui se contredisent à l'intérieur d'une même réponse JSON.** `/api/kol/bkokoski/proceeds` rend `totalProceedsUsd: 210900` et, trois champs plus bas, `proceedsByYear: {"2025": 900.06}` — un facteur **234**, avec l'étiquette `pricingQuality: "high"`. Ce n'est pas une divergence entre deux tables qu'un lecteur devrait aller croiser : c'est un document qui se contredit lui-même, servi tel quel [VÉRIFIÉ: capture curl production, §C-11.1].

**2. L'absence de donnée est traitée partout comme une absence de risque.** Un fournisseur mort (`public-api.solscan.io`, **HTTP 404 vérifié en direct**) supprime silencieusement un facteur de risque du score public, sans log, sans marqueur, et la confiance affichée reste « Medium ». L'adaptateur de score **détient** les drapeaux `rpc_down` / `rpc_fallback_used` et ne les transmet pas au moteur. La fonction durcie qui aurait imposé `confidence = Low` en cas de RPC mort (`computeConfidenceLevel`) a **zéro appelant** [VÉRIFIÉ: §C-4].

**3. Rien de ce que le système publie n'est reconstructible, et beaucoup n'a jamais existé.** `ScoreSnapshot` = 0 ligne pour 14 sites d'appel du moteur de score. `computeProceedsForHandle` **supprime** l'historique d'événements d'un KOL avant de le réécrire, hors transaction. Résultat mesurable aujourd'hui : le résumé publié de `sxyz500` déclare **151 événements** ; la base en contient **1** pour ce handle. Les 150 autres n'existent plus et ne sont pas rejouables [VÉRIFIÉ: §C-8, §C-11.2].

Un système qui note des personnes, dont les preuves ne sont pas reconstructibles, dont la confiance ne baisse jamais quand les données manquent, et dont trois actions humaines au total ont été enregistrées en base depuis l'origine, ne peut pas être ouvert à des testeurs, des avocats ou des investisseurs sans que ces trois points soient traités.

**Ce qui empêche `CRITICAL` :** les frontières d'accès tiennent (sondes production : 401 en anonyme sur les 7 surfaces testées), aucune écriture publique non authentifiée n'a été trouvée, la suppression de données du vault est auditée avant le fait, et le seul pipeline critique doté d'un DLQ n'a jamais eu à s'en servir (0 dead-letter sur 3 295 événements).

---

# B — TOP 10 RISKS

| # | Risque | Impact | Preuve |
|---|---|---|---|
| **1** | `/api/kol/{handle}/proceeds` compose un chiffre issu d'une table avec les métadonnées de provenance d'une autre. Le total publié est dominé à 96–99,97 % par **une seule ligne CSV importée à la main**, tandis que `eventCount`, `walletCount`, `pricingQuality`, `confidence`, `computedAt` décrivent la partie on-chain restante. | Un chiffre nominatif faux, estampillé « high », indéfendable | §C-11.1 |
| **2** | `computeProceedsForHandle` fait `DELETE` puis `INSERT` **hors transaction**, avec des appels Helius entre les deux, sans retry ni contrôle d'erreur (`j.result ?? null`). Un 429 Helius réécrit un montant public à la baisse sans erreur ni alerte. | Perte irréversible + chiffre public faux | §C-8 |
| **3** | Les preuves derrière les totaux publiés n'existent pas en base. `sxyz500` : résumé = 151 événements, base = 1. `bkokoski` : 50 vs 5. Cause : `ON CONFLICT ("txHash") DO NOTHING` sur une contrainte **globale**, et résumé calculé depuis la mémoire, pas depuis ce qui a été persisté. | Impossible de justifier un montant publié | §C-11.2 |
| **4** | `public-api.solscan.io` rend **HTTP 404** (vérifié en direct). `fetchTopHolderPct` rend donc `null` à 100 %. Les signaux `holders_concentrated_80/60` et le `cluster_risk` associé **ne se déclenchent jamais** sur `/api/v1/score`. | Token dangereux noté plus sûr, silencieusement | §C-4.1 |
| **5** | `computeTigerScoreFromScan` reçoit `rpc_down` et `rpc_fallback_used`, les transmet aux *evidence* et **pas** au calcul du score ni à la confiance. `computeConfidenceLevel` (règle « RPC down → Low, toujours ») : **0 appelant**. | La confiance ne baisse jamais quand la donnée manque | §C-4.2 |
| **6** | `snapshotScore` : **0 appelant**, `ScoreSnapshot` : **0 ligne**, pour **14 sites d'appel** du moteur (public, partner, mobile, telegram, watch, reflex, destination-risk). `methodologyVersion` est le littéral `'v1'` codé en dur dans le SQL. | Aucun score passé n'est reconstructible ni versionné | §C-8.1 |
| **7** | 187 liens en `reviewStatus = 'approved_public'`, **2** portent un `reviewedAt`. Le `reviewedBy` vaut la chaîne littérale `"admin"`. Total des transitions humaines enregistrées, toutes tables confondues : **3**, le 2026-06-29. **16 routes admin mutantes sur 112** écrivent un audit. | Le contrôle éditorial humain n'est pas démontrable | §E |
| **8** | `JobRunLog` ne connaît qu'**un seul** `jobName` sur 22 pipelines. `sendOpsAlert` a **3 sites d'appel**, tous dans un unique cron. `alertIdentityBacklog` est **inatteignable** : le cron sort par `if (pending.length === 0) return` avant de compter. 160 décisions d'identité attendent depuis 25 jours, jamais signalées. | Un pipeline peut mourir des mois sans alerte | §F |
| **9** | `YEARLY_FALLBACK` = table de constantes 2024/2025/2026 codées en dur. Écrite dans `PriceCache` avec `ON CONFLICT DO NOTHING` → **le cache ne guérit jamais**. 54 lignes sur 119 (45 %) sont des constantes, alors que Binance répond HTTP 200 aujourd'hui. `Math.min(Math.max(year,2024),2026)` : au 2027-01-01, tout est valorisé au prix 2026. | Montants faux jusqu'à ±40 %, et bombe à retardement datée | §C-5.2 |
| **10** | Un cookie `investigator_session` de valeur arbitraire ouvre **11 endpoints nominatifs / ~85 Ko** ; **5 des 6** routes nominatives principales n'ont **aucun rate-limit**. `admin_session` est un HMAC **constant** (`HMAC(ADMIN_BASIC_PASS, ADMIN_TOKEN)`) : ni expirable côté serveur, ni révocable, identique pour tout porteur. | Extraction massive non attribuée du corpus nominatif | §C-10 |

---

# C — FAILURE MATRIX

| Pipeline | Failure mode | Détection | Recovery | Data loss risk | Status |
|---|---|---|---|---|---|
| `helius-scan` → `computeProceedsForHandle` | Helius 429/500/timeout → `j.result ?? null` → 0 événement après le `DELETE` | **Aucune** (aucun log d'erreur, aucune alerte, `catch` rend `success:false` ignoré par l'appelant) | Aucune — les événements supprimés ne sont pas récupérables | **ÉLEVÉ, réalisé** (sxyz500 : 150 événements perdus) | 🔴 |
| `computeProceedsForHandle` (concurrence) | 2 runs simultanés : `DELETE` de l'un pendant l'`INSERT` de l'autre ; `_lastRecompute` est un `Map` mémoire par lambda ; `finally { $disconnect() }` coupe le client d'un run concurrent | Aucune | Aucune | **ÉLEVÉ** | 🔴 |
| `/api/v1/score` — holders | Provider mort (404 permanent) | Aucune (`catch → null`) | N/A | Nul (mais score faux) | 🔴 |
| `/api/v1/score` — market | DexScreener + GeckoTerminal KO → `nullSnapshot(data_unavailable:true)` **mis en cache 10 min** | Marqueur présent mais non transmis au score | Auto après 10 min | Nul | 🟠 |
| `getPriceAtDate` | Binance KO → constante annuelle → écrite en cache durable | Aucune | **Aucune** (`ON CONFLICT DO NOTHING` empêche la correction) | Nul mais valeur définitivement fausse | 🔴 |
| `intel/ingest/scamsniffer` | Timeout runtime en cours d'ingestion | `status` reste `running` à vie, `errorMessage` NULL | Aucune (pas de reaper) | Partiel silencieux | 🔴 |
| `intel/ingest/ofac` | — | `status=success`, `recordsFetched/New/Updated/Removed` renseignés, `triggeredBy` renseigné | Rejeu manuel possible | Nul | 🟢 |
| `process-events` / `DomainEvent` | Handler throw | `retryCount`, `nextRetryAt`, `deadLetteredAt`, `alertDeadLetter` | Retry ×3 puis DLQ | Nul | 🟢 mécanisme / 🟠 jamais exercé (`retryCount = 0` sur **3 295** lignes) |
| `process-events` (cadence) | Backoff 2 / 10 / 30 min | — | Le seul ordonnanceur est le cron **quotidien** → un retry « 2 min » a lieu ~24 h plus tard ; épuisement des 3 essais = **3 jours** | Nul | 🟠 |
| `process-events` (coalescing) | ≥3 `kol.updated` pour un handle en 2 min → les suivants sont acquittés **sans rebuild** | Aucune | Aucune | **Mise à jour perdue** | 🟠 (jamais déclenché : 0 `kol.updated` en base) |
| `retail-process-queue` | Vision KO / non-JSON / image absente | `ERROR_RETRYABLE` vs `ERROR_FINAL`, tentatives bornées, `markProcessing` = verrou optimiste, budget re-vérifié avant chaque appel | Rejeu borné | Nul | 🟢 jamais exercé (table à 0 ligne) |
| `watcher-bridge` | `WATCHER_BRIDGE_ENABLED=false` | `JobRunLog.status='disabled'`, 32 lignes | Réactivation env | Nul | 🟢 |
| Tous les autres crons (21/22) | Quel qu'il soit | **Aucune trace en base** — `JobRunLog` ne connaît que `watcher_bridge_promote` | — | Indéterminable | 🔴 |
| `EvidenceItem` → TSA | freetsa.org KO | Retry ×3 avec backoff `[1000,3000,8000]` puis log `error` | Rejeu via `stamp-pending.ts` (manuel) | Nul | 🟠 (2 items ingérés après le 2026-07-30 restent non horodatés) |
| Vault investigateur — DELETE | Cascade partielle | `logAudit` **avant** le delete (route case) | Aucune (hard delete) | **Volontaire et assumé** | 🟢 |
| Vault investigateur — DELETE fichier | R2 KO | `catch` → la ligne DB est supprimée quand même ; `logAudit` est écrit **après** | Aucune | Objet R2 orphelin, ou suppression non tracée si `logAudit` throw | 🟠 |

---

## C-1 — Retry & failure semantics : les états dont le nom ment

La Passe A a trouvé trois états menteurs. En voici la suite.

### C-1.1 `reviewStatus = 'approved_public'` — 185 fois sur 187, personne n'a approuvé

```
visibility | reviewStatus     |   n | reviewedAt | reviewedBy | evidenceSnapshotId | caseId
public     | approved_public  | 187 |          2 |          2 |                  2 |     20
draft      | auto_draft       | 104 |          0 |          0 |                104 |      0
rejected   | rejected         |   1 |          1 |          1 |                  1 |      0
```
[VÉRIFIÉ: requête d'agrégation sur `KolTokenLink`]

Le nom de l'état promet une approbation. **185 liens sur 187 n'ont ni date, ni auteur, ni preuve attachée.** Leur `sourceType` est `manual_seed` (185 lignes) — ils ont été insérés directement dans l'état final, sans jamais transiter par une décision.

### C-1.2 `status = 'running'` — permanent

```
sourceSlug   | startedAt            | completedAt | status  | recordsFetched | recordsNew | errorMessage
scamsniffer  | 2026-08-16 01:56:50  | NULL        | running |         260000 |     260000 | NULL
scamsniffer  | 2026-08-15 02:23:49  | NULL        | running |         235000 |     235000 | NULL
scamsniffer  | 2026-04-03 14:54:39  | NULL        | running |           NULL |       NULL | NULL
ofac         | 2026-04-03 14:41:10  | NULL        | running |           NULL |       NULL | NULL
ofac         | 2026-04-03 14:38:54  | NULL        | running |           NULL |       NULL | NULL
```
[VÉRIFIÉ: `select * from intel_ingestion_batches order by "startedAt" desc`]

**5 des 10 batches d'ingestion sont `running` pour toujours.** Aucun timeout, aucun reaper, aucun `failed`, aucun `errorMessage`. Les deux runs scamsniffer les plus récents (08-15 et 08-16) sont dans ce cas : le compteur est écrit **avant** la fin (260 000 « nouveaux » alors que la table entière en contient 339 476), puis le runtime coupe. La question « la dernière ingestion scamsniffer est-elle complète ? » n'a pas de réponse dans le système.

À décharge : `triggeredBy` existe et distingue `admin:cron`, `manual:dood`, `local-test`. C'est la **seule** table du dépôt qui trace l'origine d'un run.

### C-1.3 `pending` — l'état d'attente que rien ne surveille

```
type                      | status  | count | dernier
proceeds.recomputed       | processed | 2981 | 2026-08-16
identity.review_required  | pending   |  160 | 2026-07-22
scan.completed            | processed |  154 | 2026-07-22
```
[VÉRIFIÉ]

160 décisions d'identité nominatives attendent un humain depuis **25 jours**. Le compteur d'alerte existe (`alertIdentityBacklog`, seuil 20) — voir §F pourquoi il ne se déclenche jamais.

### C-1.4 Le retry qui n'a jamais tourné

```
retryCount | count        deadLetteredAt non nul : 0
         0 |  3295        status='dead_letter'    : 0
```
[VÉRIFIÉ]

`MAX_RETRIES = 3`, backoff `[2 min, 10 min, 30 min]`, DLQ, `alertDeadLetter` : **la machinerie complète n'a jamais été exercée une seule fois** dans toute l'histoire de la table. Elle est correcte à la lecture ; elle n'est pas éprouvée.

Et son backoff est fictif : `nextRetryAt = now + 2 min`, mais le seul déclencheur est `"path": "/api/cron/process-events", "schedule": "0 3 * * *"` — **un run par jour** (plan Hobby). Un retry « dans 2 minutes » a donc lieu ~24 h plus tard, et l'épuisement des trois essais prend **trois jours**. *Retryable ≠ Retried.*

### C-1.5 Famille C (`parseInt` / `parseFloat`) — traitée, avec deux résidus

La famille env est **close** : `src/lib/config/envNumber.ts` implémente une lecture stricte (rejette `""`, `"24 000"`, `"15s"`, `Infinity`, non-entier) et documente pourquoi `Number.isFinite` ne suffit pas. Recherche exhaustive : les seuls `parseInt`/`parseFloat` appliqués à `process.env` sont dans `envNumber.ts` lui-même et dans `src/lib/vault/scanRateLimit.ts:32`, qui est le motif de référence [VÉRIFIÉ: `grep -rn "parseInt\|parseFloat\|Number(" src | grep process.env`].

102 autres occurrences subsistent sur des données non-env. Deux méritent d'être citées, car ce sont des **conversions de risque** :

- `src/app/api/casefile/route.ts:141,173,234` — `parseFloat(onChain?.distribution?.top10_pct ?? "0")`. `fetchHolders` rend `null` sur **toute** défaillance (`!r.ok`, `catch`, tableau vide). Donc panne RPC → `top10 = 0` → aucun `concentration_flag`, aucun `+10` au score, aucune claim promue « Corroborated ». **Absence de donnée = concentration nulle = pas de risque.**
- `src/app/api/market/route.ts:57` — `parseInt(entry.value, 10) : NaN`, avec `NaN` explicite ensuite comparé.

---

## C-2 & C-3 — Idempotence & concurrence

### C-2.1 Les protections réellement présentes [VÉRIFIÉ: `pg_index` sur 27 tables de pipeline]

| Table | Clé d'unicité | Verdict |
|---|---|---|
| `DomainEvent` | `idempotencyKey` (partiel, WHERE NOT NULL) | 🟢 |
| `EvidenceItem` | `sha256` | 🟢 |
| `EvidenceSnapshot` | `sha256` | 🟢 |
| `KolTokenLink` | `(kolHandle, contractAddress, chain)` | 🟢 |
| `KolTokenInvolvement` | `(kolHandle, chain, tokenMint)` | 🟢 |
| `KolProceedsSummary` | `kolHandle` | 🟢 |
| `ShillEvent` | `(kolHandle, tweetId, tokenMint)` | 🟢 |
| `ShillBuyerObservation` | `(shillEventId, wallet)` | 🟢 |
| `social_post_candidates` | `dedupKey` + `(postId, influencerId)` | 🟢 |
| `intel_source_observations` | `(entityId, sourceSlug)` | 🟢 |
| `WatcherCampaignKOL` | `(campaignId, kolHandle)` | 🟢 |
| `MmScore` | `(subjectType, subjectId, chain)` | 🟢 |
| `PriceCache` | `(symbol, dateOnly)` | 🟢 |
| `TokenPriceTracker` | `(chain, contractAddress)` | 🟢 |
| **`EvidenceLink`** | **aucune** (pkey seul) | 🔴 |
| **`KolWallet`** | **aucune** sur `(kolHandle, address)` | 🔴 |
| **`KolProceedsEvent`** | `txHash` **seul, globalement** | 🔴 (voir C-2.3) |

### C-2.2 Les doublons existent déjà en production

```
EvidenceLink — groupes (evidenceItemId, linkType, externalId) en doublon : 34
KolWallet    — 482 lignes, 480 couples (kolHandle, address) distincts → 2 doublons
```
[VÉRIFIÉ]

Les deux doublons de `KolWallet` :

| kolHandle | address | n | attributionSource |
|---|---|---|---|
| 0xBossman | `9P2np34H…yF9` | 2 | `botify_investigation`, `botify_leak_doc_confirmed` |
| Moneylord | `7QquANyv…8JJ` | 2 | `botify_leak_doc_confirmed` (×2, labels différents) |

Ce ne sont pas des doublons inertes : `computeProceedsForHandle` itère sur `profile.kolWallets.filter(status==='active')`, donc **le même portefeuille est scanné deux fois** et alimente `walletCount` deux fois.

### C-2.3 La contrainte `txHash` globale détruit des données

`KolProceedsEvent_txHash_key` est `UNIQUE (txHash)` — **pas** `(kolHandle, txHash)`. L'insertion est faite avec `ON CONFLICT ("txHash") DO NOTHING` (`proceeds.ts:290`).

Conséquence : lorsque deux handles partagent un token (BOTIFY est commun à `GordonGekko`, `bkokoski`, `sxyz500`, `Myrrha`, `OrbitApe`, `James`) ou lorsqu'un portefeuille est revendiqué par deux profils, la **deuxième** écriture de la même transaction est silencieusement abandonnée. Or `totalProceedsUsd` du résumé est calculé depuis le tableau **en mémoire** (`dedupedEvents`), pas depuis ce qui a été effectivement persisté. Le résumé décrit donc des événements qui n'existent pas.

Mesure directe (§C-11.2) : `sxyz500` → `eventCount = 151`, lignes réelles = **1**.

### C-2.4 Les collisions non protégées

| Scénario | Protection | Verdict |
|---|---|---|
| Deux `computeProceedsForHandle` simultanés sur le même handle | `_lastRecompute` : `Map` **en mémoire du lambda**, fenêtre 5 min | 🔴 inopérant entre instances |
| Idem — connexion | `finally { await prisma.$disconnect() }` sur un `PrismaClient` **module-level** : le premier run terminé déconnecte le client pendant que le second écrit | 🔴 |
| `approve` + `archive` simultanés sur un lien | Aucun verrou, aucun `updatedAt` optimiste sur `KolTokenLink` | 🔴 (probabilité faible : 3 actions humaines en 5 mois) |
| Deux `process-events` simultanés | Pas d'état `processing`, pas de `SELECT … FOR UPDATE SKIP LOCKED` : `findMany(status:'pending')` puis traitement | 🟠 (le producteur appelle aussi `processEvent` en direct) |
| Deux scans du même token | `TokenScanAggregate.upsert` avec `increment` | 🟢 atomique |
| File retail | `markProcessing(row.id)` = verrou optimiste, `if (!locked) continue` | 🟢 |

---

## C-4 — Provider failure : « pas de données » ≠ « pas de risque »

**C'est la section la plus grave du rapport.** La question posée par le cadrage — *où l'absence de données est-elle traitée comme une absence de risque ?* — a une réponse structurelle : **partout dans la chaîne de score**, et nulle part ailleurs.

### C-4.1 Un fournisseur mort qui abaisse le score, en silence

```
$ curl -s -o /dev/null -w '%{http_code}' \
  'https://public-api.solscan.io/token/holders?tokenAddress=EPjFWdd5…&limit=10&offset=0'
404
```
[VÉRIFIÉ: sonde en direct, 2026-08-16, 0,16 s]

Ce point d'accès est appelé à deux endroits :

- `src/app/api/v1/score/route.ts:38` → `fetchTopHolderPct` : `if (!res.ok) return null`, `catch → null`.
- `src/app/api/solana/holders/route.ts:19` → rend `{ ok: true, holders_source: "unavailable", top10_pct: null }` et **met l'échec en cache 5 minutes**. Le drapeau `ok` vaut `true` sur une panne totale. (Aucun appelant hors test dans le dépôt.)

Effet sur `computeTigerScore` (`engine.ts:241-253, 291-294`), `top10_holder_pct` étant toujours `null` :

| Driver | Delta perdu |
|---|---|
| `holders_concentrated_80` (>80 % du supply) | **−15** |
| `holders_concentrated_60` (>60 %) | **−10** |
| `cluster_risk` (≥3 signaux forts) | **−10** dans les cas limites (`strongSignals` amputé de 1) |

Un token dont le top 10 détient 95 % du supply est aujourd'hui noté **exactement comme** un token parfaitement distribué. Sans erreur, sans log, sans marqueur dans la réponse, et avec `confidence` inchangée.

Les autres fournisseurs sont vivants [VÉRIFIÉ: sondes en direct] : DexScreener 200, GeckoTerminal 200, Binance klines 200, `api.mainnet-beta.solana.com` 200, `ethereum.publicnode.com` 200. **Le problème est isolé et donc corrigeable — mais il n'a été détecté par rien.**

### C-4.2 Le moteur a le marqueur de dégradation en main et le jette

`src/lib/tigerscore/adapter.ts` :

```ts
export type ScanNormalized = {
  …
  rpc_fallback_used?: boolean;   // ligne 7
  rpc_down?: boolean;            // ligne 8
  …
};

export function computeTigerScoreFromScan(input: ScanNormalized): TigerScanResult {
  const tigerInput: TigerInput = {           // lignes 48-70
    chain: input.chain, deep: input.deep, …  // ← rpc_down N'Y EST PAS
  };
  const tigerResult = computeTigerScore(tigerInput);
  const evidence = buildOnChainEvidence({ …, rpc_down: input.rpc_down, … }); // ligne 80
  return { ...tigerResult, evidence, meta: { version: "p1", chain: input.chain } };
}
```

`TigerInput` (engine.ts:11-46) **ne comporte aucun champ de qualité de donnée**. Les drapeaux vont aux *evidence* (affichage) et jamais au score ni à la confiance.

Et la confiance effectivement calculée est celle-ci, `engine.ts:301` :

```ts
const confidence = drivers.length === 0 ? "Low" : input.deep ? "High" : "Medium";
```

Elle mesure **le nombre de drivers**, pas la couverture des données. Un scan où DexScreener, Helius et Solscan ont tous échoué mais où `pump_fun` s'est déclenché (ce driver ne demande **aucun** fournisseur : il teste le suffixe de l'adresse) rend `confidence: "Medium"`.

Pendant ce temps, `src/lib/tigerscore/confidence.ts` implémente exactement la bonne règle :

```
//   • RPC down / missing data → Low, always.
export function computeConfidenceLevel(input: ConfidenceInput): ConfidenceLevel {
  const { drivers, rpcDown, rpcFallbackUsed } = input;
  if (rpcDown) return "Low";
  …
```

**Appelants de `computeConfidenceLevel` hors du fichier lui-même : 0. Appelants de `confidenceFromResult` : 0.** [VÉRIFIÉ: `grep -rn` sur `src`, hors `__tests__`]

*Configured ≠ Running.* La bonne pratique est écrite, testée (`__tests__/confidence.test.ts`), et morte.

### C-4.3 L'échec du renseignement est indiscernable d'une adresse propre

`computeTigerScoreWithIntel` (`engine.ts:394-403`) :

```ts
} catch (err) {
  console.warn("[tigerscore] Intelligence lookup failed, using base score:", err);
  return { ...base, intelligence: null, finalScore: base.score, finalTier: base.tier };
}
```

Et en cas de succès sans correspondance (`engine.ts:355-362`), la réponse est **strictement identique** : `intelligence: null`, score inchangé.

Donc : base indisponible / requête en erreur / adresse réellement propre → **même sortie**. La règle « OFAC match = floor 15 » disparaît silencieusement pendant une panne, et rien dans la réponse ne permet à l'appelant de savoir que le contrôle sanctions n'a pas eu lieu.

### C-4.4 L'échec mis en cache

`src/lib/marketProviders.ts:183-188` :

```ts
if (!snapshot || snapshot.data_unavailable) {
  console.error(`[marketProviders] ALL providers failed — returning null snapshot`);
  snapshot = nullSnapshot("DexScreener and GeckoTerminal both unavailable");
}
setCache(chain, mint, snapshot);   // ← le null snapshot est mis en cache 10 min
```

Une coupure de 30 secondes chez les deux fournisseurs se propage en **10 minutes** de scans sans donnée de marché, sur toute l'instance concernée.

À décharge : `MarketSnapshot` **porte** un vrai marqueur `data_unavailable` et il est correctement consommé par `src/lib/risk/exitDoor.ts:18` et `exitDoorV2.ts:13` (→ `BLOCKED`), par `templateV2.ts:337` et par `/api/market/summary`. Le module voisin fait donc exactement ce qu'il faut. **Seule la chaîne de score l'ignore.**

### C-4.5 Le client Helius du calcul de proceeds n'a aucune gestion d'erreur

`src/lib/kol/proceeds.ts:38-47` :

```ts
async function helius(method: string, params: any[]) {
  const res = await fetch(HELIUS_RPC, { … signal: AbortSignal.timeout(15000) });
  const j = await res.json();
  return j.result ?? null;     // ← ni res.ok, ni j.error, ni retry, ni 429
}
```

Un 429 ou un 500 renvoie un corps JSON d'erreur → `j.result` est `undefined` → `null` → `if (!sigs?.length) return events` → **zéro événement**, traité comme « ce portefeuille n'a rien fait ». Combiné au `DELETE` qui précède (§C-8), une panne Helius **réécrit à la baisse un montant nominatif publié**.

Le dépôt sait pourtant faire : `src/lib/mm/data/helius.ts`, `etherscan.ts` et `birdeye.ts` ont tous retry, backoff exponentiel et gestion 429/5xx. Le chemin proceeds ne les utilise pas.

---

## C-5 — Data freshness

### C-5.1 Carte de fraîcheur des sources qui alimentent une surface publique

[VÉRIFIÉ: balayage `max()` sur les 411 colonnes `timestamp` du schéma]

| Source | Dernière écriture | Âge | Alimente | Rafraîchisseur |
|---|---|---|---|---|
| `TokenScanAggregate.lastScannedAt` | 2026-08-16 14:34 | 0 j | compteur de scans | trafic live 🟢 |
| `MmScore.computedAt` | 2026-08-16 09:23 | 0 j | badges MM publics | cron `mm-batch-scan` 🟢 |
| `intel_source_observations` (scamsniffer) | 2026-08-16 01:56 | 0 j | overlay intelligence | cron 🟢 (mais batch `running`) |
| `KolProceedsEvent` | 2026-08-16 04:25 | 0 j **pour 5 handles** | montants publics | cron `helius-scan` 🟠 |
| `EvidenceLink` / `EvidenceItem` | 2026-08-14 13:54 | 2 j | dossiers | manuel 🟠 |
| `PriceCache.fetchedAt` | 2026-08-12 04:49 | 4 j | valorisation proceeds | `price-cache-refresh` **non planifié** 🔴 |
| `InvestigatorSession` / `InvestigatorAuditLog` | 2026-07-22 14:00 | **25 j** | espace investigateur | usage humain 🔴 |
| `KolTokenLink.reviewedAt` | 2026-06-29 06:44 | **48 j** | publication nominative | humain 🔴 |
| `KolProceedsSummary` (sxyz500) | 2026-04-27 04:55 | **111 j** | `/api/kol/sxyz500/proceeds`, `pricingQuality:"high"` | 🔴 |
| `intel_source_observations` (forta) | 2026-04-08 18:58 | **130 j** | overlay intelligence | aucun 🔴 |
| `KolProfile.last_reviewed_at` | 2026-04-18 06:36 | **120 j** | profils publiés | humain 🔴 |
| `social_posts` | 2026-04-19 18:24 | **119 j** | `detectSellWhileShilling`, evidence packs | aucun 🔴 (Passe A) |
| `TokenPriceTracker.lastRefreshAt` | 2026-05-15 19:33 | **93 j** | suivi de pic | `price-cache-refresh` **non planifié** 🔴 |
| `KolTokenInvolvement.lastComputedAt` | 2026-04-11 11:00 | **127 j** | `/api/watchlist` `cashout.total` | aucun 🔴 |

**Aucune de ces surfaces n'affiche l'âge de la donnée qu'elle sert.** `/api/kol/{handle}/proceeds` expose bien `computedAt`, mais ne dérive aucune conséquence : `sxyz500` est servi avec `computedAt: "2026-04-27"` **et** `pricingQuality: "high"` [VÉRIFIÉ: capture curl].

### C-5.2 `PriceCache` : un cache empoisonné qui ne guérit pas

```
source              | symbol | count | première   | dernière   | min    | max
binance_historical  | SOL    |    65 | 2025-01-09 | 2026-01-27 | 117.17 | 257.36
yearly_fallback     | SOL    |    54 | 2025-01-27 | 2026-08-11 | 145.00 | 185.00
```
[VÉRIFIÉ]

**45 % du cache de prix est une constante codée en dur** (`src/lib/kol/pricing.ts:21-24`) :

```ts
const YEARLY_FALLBACK: Record<string, Record<number, number>> = {
  SOL: { 2024: 120, 2025: 145, 2026: 185 },
  ETH: { 2024: 2800, 2025: 2400, 2026: 2000 },
};
```

Trois défauts distincts, tous vérifiés :

1. **L'erreur est massive.** Sur la même période, Binance donne entre 117,17 $ et 257,36 $ ; la constante dit 145 $ (2025) ou 185 $ (2026). Écart jusqu'à **±40 %** sur un montant publié comme fait documenté.
2. **Le cache ne se répare jamais.** L'écriture est `INSERT … ON CONFLICT (symbol,"dateOnly") DO NOTHING` (`pricing.ts:115-119`), et la lecture DB est **prioritaire** (`pricing.ts:54-65`). Une panne Binance d'une minute fixe donc définitivement le prix de cette date. Preuve : **Binance répond HTTP 200 aujourd'hui**, et les 54 lignes `yearly_fallback` sont toujours là, dont une du 2026-08-11.
3. **Elle a une date de péremption non signalée.** `const fallbackYear = Math.min(Math.max(year, 2024), 2026)` : au **2027-01-01**, chaque événement de 2027 sera valorisé au prix 2026 (185 $/SOL), étiqueté `yearly_fallback`, sans erreur ni alerte. Le module n'a **aucun test** (`src/lib/kol/` ne contient aucun fichier de test).

### C-5.3 Un troisième prix codé en dur, déjà en base

```
pricingSource                | events | usd_total | kols
binance_historical           |   5407 | 15292471  |   10
ARKHAM_CSV                   |      6 |  2104000  |    6
CEX_DETECTED                 |      2 |    63105  |    1
helius_sol_estimate_200usd   |    133 |    54624  |   15
yearly_fallback              |     53 |    38424  |    3
arkham_aggregate             |      1 |      408  |    1
```
[VÉRIFIÉ]

`helius_sol_estimate_200usd` : **133 événements, 54 624 $, 15 KOLs**, valorisés à **200 $/SOL en dur** (`src/scripts/seed/botifyKolScan.ts:321,332`). Le nom de la source porte la constante — c'est honnête — mais la valeur alimente `totalDocumented` comme n'importe quelle autre.

---

## C-6 — Observability

Voir §F pour le détail. Résumé chiffré :

| Mesure | Valeur | Preuve |
|---|---|---|
| Pipelines avec un enregistrement de run en base | **1 / 22** (`watcher_bridge_promote`) | `select "jobName", count(*) from "JobRunLog" group by 1` |
| Sites d'appel de `sendOpsAlert` dans tout le dépôt | **3**, tous dans `/api/cron/process-events` | `grep -rn` |
| Fonctions d'alerte typées jamais appelées | `alertRecomputeFailed`, `alertIngestionFailureSpike` | `grep -rn` |
| Alertes de type « heartbeat / le pipeline n'a pas tourné » | **0** | inventaire |
| Canaux configurés en production | Telegram (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_OPS_CHAT_ID`) et Resend (`RESEND_API_KEY`) | `vercel env ls production` |

---

## C-7 — Dead letter / poison data

| Chemin | Quarantaine | Échec terminal | Raison persistée | Correction + replay |
|---|---|---|---|---|
| `DomainEvent` | `status='dead_letter'` + `deadLetteredAt` | ✅ après 3 essais | `error` (500 car.) — **écrasé à chaque essai, pas d'historique** | Aucune UI ; `alertDeadLetter` envoie l'id | 🟠 jamais exercé |
| File retail OSINT | `ERROR_FINAL` vs `ERROR_RETRYABLE` avec tentatives bornées, `ERROR_FINAL` sur `VISION_NOT_JSON` et sur image absente | ✅ | ✅ message complet | `retailStore` refuse de rejouer un `ERROR_RETRYABLE` épuisé (`retailStore.ts:299-306`) | 🟢 |
| `intel_ingestion_batches` | **aucune** | ❌ — reste `running` | ❌ `errorMessage` NULL | ❌ | 🔴 |
| `social_post_candidates` | `needs_review` (207), `resolution_pending` (172) | ❌ — pas d'état terminal d'échec | partiel | ❌ | 🟠 |
| `computeProceedsForHandle` | **aucune** — un mint illisible ou un tx malformé est simplement `catch { continue }` (`proceeds.ts:198`) | ❌ | ❌ | ❌ | 🔴 |
| `KolProceedsEvent` | 74 lignes avec `amountUsd IS NULL`, exclues silencieusement par le filtre `amountUsd > 0` | — | ❌ | ❌ | 🟠 |

**Le point dur :** 6 667 candidats sociaux sur 7 052 (94,5 %) sont dans l'état `new`. Ce n'est ni une file, ni une quarantaine, ni un échec — c'est un état sans propriétaire, sans SLA et sans consommateur.

```
status              | count
new                 |  6667
needs_review        |   207
resolution_pending  |   172
clustered           |     3
approved_public     |     2
rejected            |     1
```
[VÉRIFIÉ]

---

## C-8 — Replay & reconstruction

### C-8.1 Aucun score n'est reconstructible

`src/lib/tigerscore/versioning.ts` écrit une ligne `ScoreSnapshot` immuable par calcul : version du moteur, `topReasons`, `provenanceData`, `governedStatus`, `rawInput`. Le commentaire d'en-tête est explicite : *« so we can always reconstruct why a given number was shown at a given moment »*.

```
Appelants de snapshotScore        : 0   (hors __tests__)
Appelants de buildProvenance      : 0   (hors __tests__)
Lignes dans ScoreSnapshot         : 0
Sites d'appel du moteur de score  : 14
```
[VÉRIFIÉ]

Les 14 sites : `/api/v1/score`, `/api/scan/solana`, `/api/scan/evm`, `/api/scan/eth`, `/api/partner/v1/transaction-check`, `/api/partner/v1/batch-score`, `/api/partner/v1/score-lite`, `/api/mobile/v1/scan`, `/api/report/v2`, `src/lib/telegram/bot.ts`, `src/lib/watch/engine.ts`, `src/lib/publicScore/computeVerdict.ts`, `src/lib/destination-risk/checker.ts`, `src/lib/reflex/adapters/tigerscore.ts`.

Seul `governedStatus.ts` est câblé, et sur **une** route (`/api/scan/evm:148`).

Conséquence : si un bug du moteur est découvert demain, **il est impossible de savoir quel score a été montré à qui, quand, avec quelles entrées**. Aucun rejeu, aucune reconstitution, aucune contestation instruite.

### C-8.2 Le calcul de proceeds détruit sa propre matière première

`src/lib/kol/proceeds.ts:231-234` :

```ts
await prisma.$executeRawUnsafe(
  `DELETE FROM "KolProceedsEvent" WHERE "kolHandle" = $1 AND "eventType" != 'SUMMARY_ARKHAM'`,
  handle,
);
```

Puis, **hors transaction**, des dizaines d'appels réseau Helius (`getSignaturesForAddress` + `getTransaction` par signature, timeout 15 s chacun), puis les `INSERT`.

Quatre conséquences, toutes structurelles :

1. **Une panne, un timeout de lambda ou un throw entre les deux laisse le handle amputé, définitivement.** Aucun rollback, aucune sauvegarde.
2. **Pendant la fenêtre, la vérité publique est fausse.** Un lecteur de `KolProceedsEvent` pour ce handle voit 0 ligne.
3. **Les événements bruts ne sont jamais conservés.** Le rejeu suppose de réinterroger Helius, dont l'historique n'est ni garanti ni gratuit — c'est exactement la dépendance que le cadrage §8 demande de chercher.
4. **Le résumé est calculé depuis la mémoire**, pas depuis la base (§C-2.3), donc il peut décrire des événements jamais persistés.

### C-8.3 Les événements du domaine ne couvrent qu'une partie du modèle

```
Types déclarés dans processEvent : scan.completed, wallet.linked, proceeds.recomputed,
                                   kol.updated, casefile.ingested, identity.review_required
Types réellement présents en base : proceeds.recomputed (2981), identity.review_required (160),
                                    scan.completed (154)
```
[VÉRIFIÉ]

`kol.updated`, `wallet.linked` et `casefile.ingested` **n'ont jamais été émis**. Donc `detectAndPersistContradictions` (branché sur `kol.updated`) n'a jamais tourné — ce qui explique `ContradictionAlert = 0 ligne` malgré un détecteur et une route admin.

De même, `Retraction = 0 ligne` : **le seul mécanisme de correction d'une affirmation nominative publiée n'a jamais servi et n'a laissé aucune trace d'usage.**

---

## C-9 — Data loss

| Chemin | Nature | Réversible ? | Audité ? |
|---|---|---|---|
| `computeProceedsForHandle` — `DELETE` non transactionnel | **Destruction quotidienne** de l'historique d'événements d'un KOL | **Non** | **Non** |
| `investigators/cases/[caseId]` DELETE | Hard delete + cascade (entities, files, notes, timeline, hypotheses, publish candidates) | Non (volontaire) | ✅ `logAudit` **avant** le delete, `caseId` nullable pour survivre | 🟢 |
| `investigators/…/files/[fileId]` DELETE | `deleteVaultObject(r2Key)` puis suppression DB **même si R2 échoue** ; `logAudit` **après** | Non | 🟠 si `logAudit` throw, l'acte est invisible ; si R2 throw, objet orphelin |
| `admin/graph/nodes/[id]` DELETE | `graphEdge.deleteMany` puis `graphNode.delete` — cascade manuelle non transactionnelle | Non | Non |
| `shill-correlation/process.ts:30` | `deleteMany` + `createMany` **dans une transaction** | — | 🟢 modèle à suivre |
| `admin/submissions/[id]`, `admin/batches/[id]/approve` | `riskSummaryCache.deleteMany` (cache) | Sans objet | — |
| `KolTokenLink` `archived` | Transition terminale — **aucun chemin `archived → public`** | Non (volontaire, Passe A) | ✅ `KolTokenLinkStatusLog` (0 ligne) |

**96 routes admin mutantes sur 112 n'écrivent aucun enregistrement d'audit** [VÉRIFIÉ: 112 fichiers `route.ts` sous `src/app/api/admin` exportant POST/PATCH/PUT/DELETE, dont 16 mentionnent une table d'audit ou de log de statut]. `AuditLog` et `SecurityAuditLog` : **0 ligne** chacune.

---

## C-10 — Trust boundaries

### C-10.1 Les gates tiennent — mesuré en production

```
Chemin                          anonyme  cookie beta forgé
/api/kol                            401        200
/api/watchlist                      401        200
/api/investigators/cases            401        401   ← validation DB, correct
/api/investigator/cases             401        401
/api/admin/kol                      401        401
/api/casefile                       401        401
/api/scan/grounding                 401        400   ← gate franchi, param manquant
```
[VÉRIFIÉ: sondes GET production, 2026-08-16]

### C-10.2 Ce que le cookie forgé ouvre réellement

Le cadrage demande de **mesurer**. Mesuré, avec `Cookie: investigator_session=passe-b-audit` :

| Endpoint | HTTP | Octets | Rate-limit |
|---|---|---|---|
| `/api/kol` | 200 | 20 771 | ✅ `RATE_LIMIT_PRESETS.public` |
| `/api/kol/leaderboard` | 200 | 17 159 | ❌ |
| `/api/watchlist/signals` | 200 | 14 288 | ❌ |
| `/api/explorer` | 200 | 13 802 | ❌ |
| `/api/v1/kol` | 200 | 12 320 | ❌ |
| `/api/v1/kol/GordonGekko` | 200 | 3 679 | ❌ |
| `/api/laundry/GordonGekko` | 200 | 2 541 | ❌ |
| `/api/coordination/GordonGekko` | 200 | 991 | ❌ |
| `/api/kol/GordonGekko/proceeds` | 200 | 832 | ❌ |
| `/api/scan/grounding?token=BOTIFY` | 200 | 197 | ❌ |
| `/api/kol/GordonGekko/cashout` | 200 | 82 | ❌ |
| **Total** | | **~85 Ko** | **1 / 11 protégée** |

Le rate-limit est par ailleurs clé **IP seule** (`checkRateLimit(getClientIp(req), …)`, `rateLimit.ts:183`) : il n'existe aucune notion de quota par porteur de cookie. Un porteur de cookie beta — c'est-à-dire n'importe qui — peut extraire l'intégralité du corpus nominatif, en boucle, sans limite et **sans qu'aucune trace nominative de l'extraction soit conservée** (`EvidenceAccessLog` n'est alimenté que par le vault).

### C-10.3 `admin_session` n'est pas une session

`src/lib/security/adminAuth.ts:200-207` :

```ts
export function computeAdminSessionToken(): string | null {
  const pass = process.env.ADMIN_BASIC_PASS;
  const secret = process.env.ADMIN_TOKEN;
  if (!pass || !secret) return null;
  return createHmac("sha256", secret).update(pass).digest("hex");
}
```

La valeur est une **constante déterministe de l'environnement**. Elle est donc :

- **identique pour tout administrateur** — l'identité de l'acteur ne peut pas exister ;
- **non révocable** — il n'y a pas d'état serveur ; le `maxAge: 8h` est une préférence du navigateur, pas une expiration ;
- **valable indéfiniment** une fois captée, jusqu'à rotation de `ADMIN_TOKEN` **ou** de `ADMIN_BASIC_PASS`.

Par ailleurs `setAdminCookie` (ligne 148) place la valeur **brute** d'`ADMIN_TOKEN` dans le cookie `admin_token`. Le cookie est le secret maître.

**C'est la cause racine du §E** : aucun mécanisme d'authentification du dépôt ne distingue deux humains. `reviewedBy = "admin"` n'est pas une négligence de saisie, c'est la seule valeur que le système peut produire.

### C-10.4 Distinction authentification / autorisation

Il n'y a **pas de couche d'autorisation**. Le modèle est binaire à quatre portes indépendantes :

| Porte | Preuve exigée | Granularité |
|---|---|---|
| `admin_session` / `admin_token` / Basic | secret d'env | tout ou rien |
| `investigator_session` | **présence** d'un cookie | tout le nominatif |
| `x-partner-key` | secret d'env comparé en temps constant | tout le nominatif |
| `x-mobile-api-token` | secret d'env | tout le nominatif |
| vault investigateur | session validée en base + `assertCaseOwnership` | **par objet** 🟢 |

Le seul contrôle par objet du dépôt est celui du vault (`getVaultWorkspace` + `assertCaseOwnership` / `assertFileOwnership`), et il est correct : les sondes le confirment (401 même avec un cookie beta forgé). Aucun IDOR trouvé sur ce chemin.

### C-10.5 Trois comportements de sécurité pilotés par `NODE_ENV`, qui est une variable Vercel modifiable

`NODE_ENV` figure dans les variables d'environnement du projet (`Production, Preview, Development`) [VÉRIFIÉ: `vercel env ls production`]. Trois comportements en dépendent :

- `setAdminCookie` / `setAdminSessionCookie` : `secure: process.env.NODE_ENV === "production"` — une valeur inattendue pose le cookie **sans le drapeau Secure** ;
- `assertProdEnv()` : la garde « ADMIN_TOKEN obligatoire en prod » ne se déclenche que si `NODE_ENV === "production"` ;
- `src/lib/prisma.ts` : la mémoïsation globale du client est **désactivée** quand `NODE_ENV === "production"`.

[INDÉTERMINÉ : la valeur de `NODE_ENV` en production n'est pas lisible (`vercel env pull` interdit, valeur chiffrée dans `env ls`). Le risque est structurel, pas constaté.]

---

## C-11 — Data integrity

### C-11.1 La réponse qui se contredit elle-même

Capture **en production, 2026-08-16**, `GET /api/kol/bkokoski/proceeds` [VÉRIFIÉ: curl] :

```json
{"found":true,"handle":"bkokoski",
 "totalProceedsUsd":210900,
 "proceedsByYear":{"2025":900.06},
 "topWalletProceedsUsd":900.06,
 "topTokenProceedsUsd":1076.62,
 "walletCount":22,"caseCount":3,"eventCount":50,
 "confidence":"low","methodologyVersion":"v1",
 "computedAt":"2026-08-16T04:25:12.033Z",
 "coverageStatus":"partial",
 "pricingQuality":"high", …}
```

Le total annoncé est **234 fois** la somme de sa propre ventilation. Le `topToken` (1 076,62 $) est **supérieur** au total de l'unique année déclarée (900,06 $).

Les deux autres profils publiés avec un résumé :

| handle | `totalProceedsUsd` | Σ `proceedsByYear` | rapport | `computedAt` | `pricingQuality` |
|---|---:|---:|---:|---|---|
| GordonGekko | 579 645 | 94 644,79 | **×6,1** | 2026-08-16 | `high` |
| bkokoski | 210 900 | 900,06 | **×234** | 2026-08-16 | `high` |
| sxyz500 | 141 594 | 56 604,51 | **×2,5** | **2026-04-27 (111 j)** | `high` |

**Le mécanisme, prouvé.** `src/app/api/kol/[handle]/proceeds/route.ts:44-50` :

```ts
// Pin totalProceedsUsd to KolProfile.totalDocumented (authoritative Writer A value).
const canonicalTotal = await getCanonicalTotalDocumented(handle);
return NextResponse.json({
  found: true, handle,
  totalProceedsUsd: canonicalTotal ?? s.totalProceedsUsd,   // ← table KolProfile
  proceedsByYear: …, eventCount: …, pricingQuality: …,      // ← table KolProceedsSummary
```

Le chiffre vient d'une table, **toutes ses métadonnées de provenance viennent d'une autre**. Le résultat est un enregistrement composite qui n'a jamais été produit par aucun calcul.

**Ce que le total contient réellement** [VÉRIFIÉ: ventilation par `eventType` / `pricingSource`] :

| handle | `SUMMARY_ARKHAM` (1 ligne CSV) | scan on-chain | `totalDocumented` | part du CSV |
|---|---:|---:|---:|---:|
| GordonGekko | 485 000 | 94 645 (124 événements) | 579 645 | **83,7 %** |
| bkokoski | 210 000 | 900 (4 événements) | 210 900 | **99,6 %** |
| Myrrha | 127 000 | 36 (1 événement) | 127 036 | **99,97 %** |
| sxyz500 | 85 000 | 56 605 | 141 594 | 60,0 % |
| OrbitApe | 817 000 | 0 | 817 000 | **100 %** |
| James | 380 000 | 0 | 380 000 | **100 %** |

Les six lignes `SUMMARY_ARKHAM`, totalisant **2 104 000 $**, sont ceci [VÉRIFIÉ: `select * from "KolProceedsEvent" where "eventType"='SUMMARY_ARKHAM'`] :

```
txHash        : "ARKHAM-SUMMARY-bkokoski-BOTIFY-2026"   ← chaîne synthétique
walletAddress : "ARKHAM-SUMMARY"                        ← pas une adresse
eventDate     : 2024-11-04 00:00:00+00                  ← date de remplissage, identique aux 6
caseId        : NULL
notes         : "Arkham CSV analysis — BEFTI dossier 2026"
createdAt     : 2026-04-22 18:06:22
```

Aucune URL source, aucun fichier CSV référencé, aucun `EvidenceItem` lié, aucun relecteur, aucune méthode. Ces six lignes vivent **dans la même table** que les observations on-chain et sont **indistinguables** de celles-ci pour toute requête d'agrégation. `/api/kol/bkokoski/proceeds` les publie sous l'étiquette `pricingQuality: "high"`.

### C-11.2 Les preuves du chiffre publié n'existent pas

```
kolHandle    | eventCount (résumé) | lignes réelles en base | écart
sxyz500      |                 151 |                      1 | −150
bkokoski     |                  50 |                      5 |  −45
GordonGekko  |                 128 |                    127 |    −1
Myrrha       |                   1 |                      2 |     — 
```
[VÉRIFIÉ: jointure `KolProceedsSummary` × `count(KolProceedsEvent)` par handle]

`sxyz500` : le résumé publié affirme 151 événements et 56 604,51 $ ; la base contient **une** ligne pour ce handle, et c'est la ligne CSV Arkham. **Les 150 événements qui justifient le montant n'existent nulle part.**

Mécanisme (§C-2.3 + §C-8.2) : le `DELETE` retire les anciennes lignes, le scan recalcule 151 événements en mémoire, les `INSERT … ON CONFLICT ("txHash") DO NOTHING` sont abandonnés parce que ces `txHash` appartiennent déjà à un autre handle (BOTIFY est partagé entre six profils), et le résumé est écrit depuis le tableau **mémoire**. Le chiffre survit ; sa preuve, non.

### C-11.3 `walletCount` compte des portefeuilles jamais examinés

`Myrrha` : `walletCount: 113` dans le résumé. Or `proceeds.ts:258-262` :

```ts
// Cap at 10 wallets per handle — MM clusters (Myrrha: 113 wallets) would timeout.
const walletsToScan = activeWallets
  .filter((w) => w.chain?.toUpperCase() === "SOL" && !walletsWithEvents.has(w.address))
  .slice(0, 5);
```

Le commentaire annonce 10, le code plafonne à **5**. Sur 113 portefeuilles actifs, **au plus 5** entrent dans le scan général. Et en amont, `fetchWalletGeneralSwaps` fait `getSignaturesForAddress(… { limit: 20 })` puis `sigs.slice(0, 10)` : **au plus 10 transactions par portefeuille**.

Le plafond structurel du chemin général est donc de **50 transactions par KOL**, quel que soit son volume réel — et `walletCount` en annonce 113. Le `coverageStatus` vaut `partial` sur **28 résumés sur 28**, mais aucune surface ne traduit ce `partial` en réserve sur le chiffre.

### C-11.4 Les autres divergences

| Fait | Représentations concurrentes | Source de vérité déclarée |
|---|---|---|
| Proceeds d'un KOL | `KolProfile.totalDocumented` (Explorer, leaderboard, `/api/v1/kol/[handle]`, `/api/watchlist`, `/api/mobile/v1/scan`) · `KolProceedsSummary.totalProceedsUsd` · `Σ KolTokenInvolvement.proceedsUsd` (`/api/watchlist` `cashout.total`) | **Aucune.** Deux commentaires de code se contredisent : `sync-proceeds/route.ts:6` dit « authoritative SUM in KolProceedsEvent » ; `proceeds/route.ts:44` dit « authoritative Writer A value » = `KolProfile.totalDocumented` |
| Qualité du prix | `KolProceedsSummary.pricingQuality` ∈ {`high` (3), `fallback` (24), `arkham_aggregate` (1)} vs `KolProceedsEvent.pricingSource` ∈ 6 valeurs | Non rapprochées |
| Statut de revue | `KolProceedsSummary.reviewStatus` (`published` 4 / `draft` 24) — mais `totalDocumented` est affiché quel que soit ce statut (Myrrha : résumé `draft`, 127 036 $ publiés) | Ignorée à l'affichage |
| Fraîcheur du profil | `KolProfile.updatedAt` · `lastEnrichedAt` · `lastHeliusScan` · `last_reviewed_at` (colonne en snake_case parmi 54 en camelCase) | — |
| Convention temporelle | 339 colonnes `timestamp` naïves / 72 `timestamptz`, sur 144 et 29 tables | Aucune (§D-6) |

---

## C-12 — voir §D

## C-13 — voir §E

---

## C-14 — Tests de défaillance

184 fichiers de test. Couverture par mode de défaillance [VÉRIFIÉ: `grep -rlE` sur `*.test.ts*`] :

| Mode | Fichiers | Verdict |
|---|---:|---|
| provider 500 / erreur | 26 | 🟢 |
| 401 / 403 / unauthorized | 22 | 🟢 |
| doublon / idempotence | 20 | 🟢 |
| 429 | 12 | 🟢 |
| payload malformé | 9 | 🟠 |
| poison / quarantaine | 6 | 🟠 |
| retry / backoff | 6 | 🟠 |
| timeout / abort | 5 | 🟠 |
| donnée périmée | 2 | 🔴 |
| **dead letter** | **0** | 🔴 |
| **concurrence / race** | **0** | 🔴 |

**Chemins critiques sans aucun test :**

| Module | Ce qu'il fait | Tests |
|---|---|---|
| `src/lib/kol/proceeds.ts` (359 l.) | supprime et réécrit les montants nominatifs publiés | **aucun** — `src/lib/kol/` ne contient **aucun** fichier de test, pour ses 14 modules |
| `src/lib/kol/pricing.ts` (135 l.) | valorise ces montants, avec constantes en dur et cache non réparable | **aucun** |
| `src/lib/events/processor.ts` (200 l.) | retry, backoff, DLQ, alerte | **aucun** — `src/lib/events/` n'a pas de tests |
| `src/app/api/casefile/route.ts` | note un dossier nominatif, `absence → 0` | pas de test de la route |

À décharge, la Passe A a livré une couverture exemplaire sur la route de dépublication : 14 tests de refus sur le handler + 5 mutants tués. Le modèle existe ; il n'a pas été appliqué au moteur de proceeds.

---

## C-15 — Coût opérationnel

`TRIGGER → PROVIDER → COÛT → OUTPUT → CONSUMER → VALEUR`

### C-15.1 La chaîne X — chiffrée

```
XApiUsage (table live)
monthStart   | totalCostUsd | tweetsFetched | userLookups
2026-06-01   |     11,948   |          2060 |         306
2026-07-01   |    100,792   |         17378 |        2550
2026-08-01   |     65,511   |         11295 |        1646
                 ──────────
                  178,25 $ sur 3 mois
```
[VÉRIFIÉ]

Sortie produite : **7 052 candidats** (`social_post_candidates`).
Consommateur : la revue humaine.
Valeur produite depuis l'origine : **2 candidats `approved_public`, 1 `rejected`**, tous le **2026-06-29**.

**≈ 89 $ par élément approuvé.** 6 667 candidats (94,5 %) sont restés dans l'état `new`. Le mode économique de la Passe A ramène le coût à ~20 $/cycle — il traite le débit, pas le fait que le consommateur est absent.

### C-15.2 Données produites et jamais consommées

| Actif | Volume | Consommateur | Coût |
|---|---:|---|---|
| `DomainLabel` | **632 807 lignes** | aucun (Passe A) | stockage Neon, non ventilé |
| `AddressLabel` | 217 813 | overlay intelligence | — |
| `intel_source_observations` (scamsniffer) | 338 615 | `lookupValue` → overlay TigerScore | cron quotidien |
| `intel_source_observations` (forta) | 3, gelées depuis 130 j | idem | — |
| `social_post_candidates` en `new` | 6 667 | **aucun** | API X |
| `ScoreSnapshot` | 0 | 3 fonctions de lecture (`getLatestSnapshot`, `listSnapshots`, `/api/admin/snapshots/[entityValue]`) | — |
| `onchain_events` | 0 | 3 lecteurs (Passe A) | — |
| `EquitySignal`, `Retraction`, `ContradictionAlert`, `AuditLog`, `SecurityAuditLog`, `WatchAlert`, `WatchScan`, `WatchedToken`, `alert_subscriptions`, `alert_deliveries` | 0 | code présent | — |

**~80 tables sur 176 sont à 0 ligne** [VÉRIFIÉ: comptage exact table par table]. Ce n'est pas un coût monétaire mesurable, mais c'est une surface de maintenance, de migration et de confusion qui grandit.

### C-15.3 Travail recalculé sans nécessité

- `helius-scan` (quotidien) déclenche `computeProceedsForHandle`, qui **détruit et réinterroge Helius intégralement** au lieu d'un delta incrémental. Effectivement exécuté pour **5 handles** le 2026-08-16 ; les 400+ autres datent du 2026-04-22.
- `/api/kol` reconstruit `buildKolCanonicalSnapshotBatch` sur **l'ensemble filtré, sans pagination**, à chaque requête (20 771 octets aujourd'hui).
- `getPriceAtDate` fait `clearPriceCache()` au début de chaque `computeProceedsForHandle`, invalidant le cache mémoire à chaque handle.
- `price-cache-refresh` — le cron qui rafraîchirait `TokenPriceTracker` (340 lignes, gelé depuis **93 jours**) — **n'a pas d'entrée dans `vercel.json`**.

### C-15.4 Appel IA là où une règle suffirait

`ANTHROPIC_API_KEY` est présent en production. Usages : `intel-summarize` (cron quotidien) et la vision de la file retail (`callVision`, budget contrôlé par appel, table à 0 ligne). Aucun appel IA n'a été trouvé sur un chemin où une règle déterministe suffirait. [INDÉTERMINÉ : coût réel non ventilé — aucune ligne de facturation par sous-système n'existe dans le dépôt.]

---

## C-16 — voir §H

---

# D — RETROFIT BOMBS

> Uniquement ce qui deviendra nettement plus coûteux **après** l'ouverture aux testeurs, avocats et investisseurs.

### D-1 · Aucun score n'est snapshoté — `RETROFIT COST: VERY HIGH`

`ScoreSnapshot` = 0 ligne, `snapshotScore` = 0 appelant, 14 sites de calcul. **Ce qui n'est pas capturé aujourd'hui ne sera jamais reconstructible.**

Chaque jour d'exploitation supplémentaire ajoute des scores montrés à des utilisateurs et dont on ne pourra jamais dire quelles entrées les ont produits. Brancher `snapshotScore` plus tard versionne l'avenir ; le passé reste définitivement muet. Si un testeur conteste un score de la semaine 1 en semaine 6, il n'y a **rien** à lui montrer.

Dépendances à préparer sans concevoir la solution (le cadrage l'interdit ici) : `computeConfidenceLevel` et `buildProvenance` existent déjà et sont inertes ; `governedStatus` est câblé sur une seule route ; `TIGERSCORE_ENGINE_VERSION = "1.0.0"` existe et n'est exposé nulle part.

**Données nécessaires qui se perdent aujourd'hui, à chaque scan :** l'entrée brute (`TigerInput`), l'état de disponibilité des fournisseurs au moment du calcul, la version des listes d'intelligence utilisées, et le `governedStatus` en vigueur. Aucune de ces quatre n'est écrite nulle part.

### D-2 · Le dossier `/api/casefile` n'a pas d'identifiant stable et n'est jamais persisté — `RETROFIT COST: VERY HIGH`

`src/app/api/casefile/route.ts:279` :

```ts
const caseId = crypto.randomBytes(4).toString("hex").toUpperCase();
```

Puis :

```ts
caseFile.report_hash = crypto.createHash("sha256").update(JSON.stringify(caseFile)).digest("hex").slice(0,16);
```

Le `case_id` est **aléatoire à chaque appel**. Le `report_hash` est calculé sur une charge contenant ce `case_id` aléatoire **et** `scan_timestamp: new Date().toISOString()` : deux appels sur le même mint, à la même seconde, produisent deux hachages différents. Ce n'est donc pas un hachage de contenu, et il n'atteste rien.

Le dossier n'est **écrit nulle part** : ni en base, ni en R2. Un dossier montré à un utilisateur n'est pas retrouvable, pas citable, pas comparable dans le temps. `engine_version` est le littéral `"CaseFile-v1.1"`.

Une fois que des testeurs auront cité des `case_id` dans des échanges, leur donner rétroactivement un sens sera impossible.

### D-3 · Provenance de la preuve : 1 070 items sur 1 072 sans opérateur identifié — `RETROFIT COST: VERY HIGH`

```
capturedBy                  | captureHost | count
legacy:evidence-snapshot    | NULL        |   925
backfill:unknown-operator   | NULL        |   145
operator:probe2             | NULL        |     1
operator:probe-postdeploy   | NULL        |     1

immutableStored | provenanceType        | timestampMode | tsaProvider  | count
false           | NULL                  | NULL          | freetsa.org  |  1070
false           | FIRST_PARTY_CAPTURE   | at-ingestion  | NULL         |     2
```
[VÉRIFIÉ]

**1 070 pièces portent un jeton d'horodatage TSA de freetsa.org et n'ont ni opérateur, ni hôte de capture, ni type de provenance, ni mode d'horodatage.** Un TSA prouve qu'un fichier existait à l'instant T. Il ne prouve ni qui l'a capturé, ni de quoi, ni comment. Présenter une pièce `backfill:unknown-operator` horodatée comme un élément de chaîne de conservation est exactement ce qui ne tiendra pas devant un contradicteur.

`immutableStored = false` sur **100 %** : R2 n'est pas en mode WORM.

La rétro-attribution est impossible par construction : l'information n'a jamais été collectée.

**Sous-point :** `tsaTimestampedAt` s'arrête au **2026-07-30** alors que `ingestedAt` va jusqu'au **2026-08-14**. L'horodatage n'est pas dans le chemin d'ingestion ; il dépend d'un script manuel (`stamp-pending.ts`).

### D-4 · Observation, import tiers et allégation dans la même table — `RETROFIT COST: HIGH`

`KolProceedsEvent` mélange sans discriminant structurel :

| Nature | Marqueur disponible | Volume |
|---|---|---:|
| Observation on-chain valorisée par Binance | `pricingSource='binance_historical'` | 5 407 événements |
| Observation on-chain valorisée par une **constante** | `yearly_fallback`, `helius_sol_estimate_200usd` | 186 événements |
| **Import CSV tiers, non sourcé** | `eventType='SUMMARY_ARKHAM'` | 6 lignes, **2 104 000 $** |
| Détection heuristique CEX | `CEX_DETECTED`, `ambiguous=true` | 2 |

Le seul discriminant est une valeur de colonne texte, jamais exposée par l'API et jamais utilisée pour qualifier le chiffre. `sync-proceeds` agrège les quatre natures dans un unique `SUM` [VÉRIFIÉ: `route.ts:36-41`].

Séparer après coup suppose de rejuger 5 601 lignes dont l'origine documentaire (le CSV Arkham) n'est référencée nulle part.

### D-5 · Le rapporteur humain est une chaîne, pas une identité — `RETROFIT COST: HIGH`

`reviewedBy = "admin"` sur les 3 seules lignes revues, parce que `admin_session` est un HMAC constant de l'environnement (§C-10.3). **Le système est structurellement incapable de nommer un relecteur.**

Rétrofit : introduire des comptes nommés est faisable, mais toutes les décisions déjà prises (3) et toutes celles prises d'ici là resteront attribuées à un acteur collectif. Chaque semaine d'exploitation supplémentaire ajoute des décisions non attribuables.

### D-6 · 339 colonnes de date naïves contre 72 conscientes du fuseau — `RETROFIT COST: HIGH`

```
timestamp without time zone : 339 colonnes sur 144 tables
timestamp with time zone    :  72 colonnes sur  29 tables
```
[VÉRIFIÉ]

Aujourd'hui le serveur est en GMT et les écritures sont en UTC : **ça marche**. Le risque est qu'un seul écrivain injecte une heure locale dans une colonne naïve, et plus rien ne permettra de dire, rétroactivement, quelles valeurs étaient en UTC.

Ce n'est pas théorique. `XApiUsage.monthStart` vaut `2026-06-30T22:00:00` pour le mois de juillet — c'est **2026-07-01 00:00 en heure de Paris** écrit dans une colonne naïve. La frontière de mois d'un compteur de coût est déjà décalée de 2 h.

Sur un produit médico-légal où l'horodatage d'un événement **est** la preuve, une migration ultérieure de 339 colonnes sans savoir lesquelles sont fausses est un chantier à haut risque.

### D-7 · La table `KolProceedsEvent` est régénérable, donc non probante — `RETROFIT COST: HIGH`

`DELETE` + réécriture quotidienne, hors transaction, sans conservation des réponses brutes du fournisseur. Impossible de figer *a posteriori* ce qui a été observé le jour J. Toute politique de rétention, de contestation ou d'audit posée plus tard ne pourra s'appliquer qu'aux données postérieures à sa mise en place.

### D-8 · Aucun état mutable n'a d'audit trail — `RETROFIT COST: MEDIUM`

96 routes admin mutantes sur 112 n'écrivent rien. `AuditLog` = 0 ligne. Les tables de journal qui existent (`KolTokenLinkStatusLog` 0, `CandidateStatusLog` 1 578 dont 3 humaines, `VaultAuditLog` 313 gelées depuis le 2026-05-03, `InvestigatorAuditLog` 274 gelées depuis le 2026-07-22) couvrent des périmètres disjoints.

Le rétrofit est faisable (ajouter un `logAudit` par route), mais l'historique des mutations déjà faites est définitivement perdu.

### D-9 · `methodologyVersion` est un littéral SQL — `RETROFIT COST: MEDIUM`

`proceeds.ts:321` : `VALUES (…, 'v1', now())`. La version de la méthodologie ne peut pas changer sans édition du SQL, et elle vaudra `'v1'` même après un changement de moteur. Les 28 résumés existants sont donc étiquetés d'une version qui ne signifie rien.

### D-10 · Aucune relation publiée n'est dépubliable au niveau du profil — `RETROFIT COST: MEDIUM`

Rappel Passe A, confirmé : `KolProfile` n'a **pas** de chemin `published → draft` outillé (`publishStatus`: 378 draft / 32 published / 1 review). Le chemin de dépublication livré le 2026-08-16 est **par lien**, pas par profil. Publier un profil reste un acte à effet de levier — jusqu'à ×53 liens d'un coup — sans dépublication symétrique.

### D-11 · 12 modules créent leur propre `PrismaClient` — `RETROFIT COST: LOW`

```
src/app/api/kol/[handle]/proceeds/route.ts        src/app/api/cron/watcher-v2/route.ts
src/app/api/kol/[handle]/cashout/route.ts         src/app/api/cron/watcher-bridge/route.ts
src/app/api/admin/kol/[handle]/proceeds/status/   src/app/api/cron/price-cache-refresh/route.ts
src/lib/kol/proceeds.ts   src/lib/kol/pricing.ts  src/lib/telegram/bot.ts
src/lib/digest/generator.ts  src/lib/watch/engine.ts  src/lib/intel/seed-sources.ts …
```
[VÉRIFIÉ: `grep -rl "new PrismaClient()"` → 13 fichiers dont `src/lib/prisma.ts`]

`DATABASE_URL` local pointe sur l'**endpoint direct** de Neon (pas `-pooler`), sans `connection_limit` ni `pgbouncer=true`, alors que `POSTGRES_PRISMA_URL` (poolé) existe et n'est pas celui que lit le schéma Prisma [VÉRIFIÉ localement ; INDÉTERMINÉ en production : la valeur de `DATABASE_URL` n'est pas lisible]. Ceci contredit `CLAUDE.md` qui annonce « port 6543 pgbouncer ».

`statement_timeout = 0` sur le serveur : aucune requête ne sera jamais interrompue [VÉRIFIÉ: `pg_settings`].

---

# E — HUMAN CONTROL : ce qu'on peut réellement prouver

**La question posée : pouvons-nous démontrer techniquement qu'un output public a subi un contrôle éditorial humain ?**

**Réponse : non. Pour aucune catégorie d'output.**

### E-1 Le registre complet des actions humaines du système

Toutes tables confondues, voici l'intégralité des transitions d'état imputées à un humain :

```
CandidateStatusLog — toStatus | actorId        | count | dernière
clustered                     | watcher_bridge |   388 | 2026-08-16
parsed                        | watcher_bridge |   385 | 2026-08-16
needs_review                  | watcher_bridge |   210 | 2026-08-16
draft_link_created            | watcher_bridge |   210 | 2026-08-16
draft_ready                   | watcher_bridge |   210 | 2026-08-16
resolution_pending            | watcher_bridge |   172 | 2026-08-16
approved_public               | admin          |     2 | 2026-06-29
rejected                      | admin          |     1 | 2026-06-29
```
[VÉRIFIÉ]

**1 575 transitions machine. 3 transitions humaines. Toutes le même jour, il y a 48 jours, par un acteur nommé `admin`.**

`KolTokenLinkStatusLog` : **0 ligne** — le chemin de gouvernance livré le 2026-08-16 n'a jamais servi (Passe A, confirmé).

### E-2 Par catégorie d'output

| Output public | Revue humaine prouvable ? | Preuve |
|---|---|---|
| **Liens KOL↔token** (187 publics) | **Non** — 2 sur 187 portent `reviewedAt`/`reviewedBy` ; les 185 autres sont en `manual_seed`, insérés directement dans l'état final | requête `KolTokenLink` |
| **Profils KOL** (32 publiés) | **Non** — `KolProfile.last_reviewed_at` max = **2026-04-18** (120 j) ; aucune colonne `reviewedBy` ; aucun log de transition `publishStatus` | schéma + requête |
| **Montants de proceeds** | **Non** — `KolProceedsSummary.reviewStatus`: 4 `published` / 24 `draft`, aucune colonne de relecteur ; `reviewNote` non renseigné ; et `totalDocumented` est affiché **quel que soit** ce `reviewStatus` (Myrrha : résumé `draft`, 127 036 $ publiés) | requête |
| **Scores TigerScore** | **Non** — aucun mécanisme de revue n'existe ; `ScoreSnapshot` = 0 ; `governedStatus` câblé sur 1 route | code |
| **Dossiers `/api/casefile`** | **Non** — les `claims` sont un littéral `CASE_DB` codé dans le fichier de route, avec des `evidence` pointant sur `IMG_2244.jpg` etc. Aucune table, aucun relecteur, aucune date de revue | `route.ts` |
| **Conclusions nominatives** (`retail_summary`, `coverageNote`) | **Non** — chaînes littérales générées par le tier calculé | `route.ts:276-283` |
| **Pièces de preuve** | **Non** — 1 070/1 072 sans opérateur identifié | §D-3 |
| **Décisions d'identité** | **Non** — 160 en attente depuis 25 jours, jamais arbitrées | `DomainEvent` |
| **Suppressions vault investigateur** | **Oui** 🟢 — `logAudit` avec `investigatorAccessId`, `profileId`, `workspaceId`, `actor`, `fingerprint`, écrit **avant** le delete | `cases/[caseId]/route.ts:145-155` |

### E-3 Les trois obstacles structurels

1. **Pas d'identité.** `admin_session` est un HMAC constant de l'environnement, `admin_token` est le secret brut. Le système ne peut pas produire un nom (§C-10.3).
2. **Pas de journal.** 96 routes admin mutantes sur 112 n'écrivent rien ; `AuditLog` = 0 ligne.
3. **Pas de distinction machine / humain à la lecture.** `reviewStatus='approved_public'` est posé indifféremment par un seed manuel de masse (185 lignes) et par une décision humaine (2 lignes). Rien dans la valeur ne les sépare ; il faut aller chercher `reviewedAt IS NOT NULL`, ce qu'aucun consommateur ne fait.

### E-4 Et la correction ?

`Retraction` = **0 ligne**. `ContradictionAlert` = **0 ligne** (le détecteur est branché sur `kol.updated`, jamais émis). Il n'existe donc **aucune démonstration technique qu'une affirmation nominative publiée puisse être corrigée**, même si le code pour le faire existe.

---

# F — OBSERVABILITY GAPS

### F-1 L'alerte qui ne peut pas se déclencher

`src/app/api/cron/process-events/route.ts` :

```ts
const pending = await prisma.domainEvent.findMany({
  where: { status: "pending",
           type: { notIn: [...HUMAN_REVIEW_TYPES] },   // exclut identity.review_required
           OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
  take: BATCH_SIZE });

if (pending.length === 0) {
  return NextResponse.json({ processed: 0, failed: 0 });   // ← SORTIE ANTICIPÉE
}
…
const identityPending = await prisma.domainEvent.count({
  where: { type: "identity.review_required", status: "pending" } });
if (identityPending > 20) void alertIdentityBacklog(identityPending);   // ← inatteignable
```

La requête **exclut** les types à revue humaine. En régime stationnaire — tout le reste traité — `pending.length === 0`, la fonction sort, et **les deux compteurs d'alerte ne sont jamais évalués**.

État réel de la base : `identity.review_required` = **160 en attente depuis le 2026-07-22**, seuil = 20. L'alerte aurait dû se déclencher **25 jours de suite**. Elle ne s'est jamais déclenchée, parce qu'elle est structurellement inatteignable exactement dans la situation où elle sert.

C'est le cas d'école du cadrage : *Logged ≠ Monitored*, et ici même pas *logged*.

### F-2 Les pipelines qui peuvent mourir en silence

| Pipeline | Comment saurions-nous qu'il est mort ? | Preuve de la mort possible |
|---|---|---|
| `helius-scan` → proceeds | **Rien.** Pas de `JobRunLog`, pas d'alerte, `computeProceedsForHandle` rend `{success:false}` que l'appelant ignore | 5 handles recalculés sur 400+ ; les autres datent du 2026-04-22 |
| `intel/ingest/scamsniffer` | **Rien.** Le batch reste `running`, `errorMessage` NULL | 2 des 2 derniers runs sont `running` à vie |
| `intel/ingest/ofac` | Partiellement — `status`, compteurs, `triggeredBy` en base, mais **aucune alerte** si le run manque | 🟠 |
| `daily-flow`, `intel-rss`, `intel-summarize`, `mm-batch-scan`, `watch-rescan`, `watch-alerts`, `weekly-digest`, `retail-process-queue`, `watcher-v2` | **Rien** — aucun enregistrement de run | 9 pipelines aveugles |
| `social_posts` | **Rien** — gelé depuis le 2026-04-19 (119 j), 4 lecteurs actifs | Passe A, confirmé |
| `TokenPriceTracker` | **Rien** — gelé 93 j, son cron `price-cache-refresh` n'est pas planifié | 🔴 |
| `KolTokenInvolvement` | **Rien** — gelé 127 j, alimente `/api/watchlist` `cashout.total` | Passe A, confirmé |
| `forta` (source intelligence) | **Rien** — 3 observations gelées depuis 130 j, toujours lues par `lookupValue` | 🔴 |
| `process-events` | ✅ partiellement — 2 alertes de backlog… inatteignables (F-1) | 🟠 |
| `watcher-bridge` | ✅ `JobRunLog` (32 lignes) | 🟢 seul cas |

### F-3 Ce qui manque à `JobRunLog`

`JobRunLog` a le bon schéma (`jobName`, `startedAt`, `finishedAt`, `status`, `processed`, `errors`, `summaryJson`) — mais :

- il ne connaît **qu'un seul `jobName`** sur 22 pipelines ;
- il n'a **pas de champ `triggeredBy`**, alors que `intel_ingestion_batches` en a un. Les 32 lignes montrent des exécutions à 05:30, 07:49, 18:45, 19:32, 20:16, 20:21, 20:28, 20:32 — pour un cron planifié `30 6 * * *`. Il est **impossible de dire** lesquelles viennent du cron Vercel, d'un script manuel (`src/scripts/watcher-bridge/run-bridge-job.ts`) ou d'un appel admin.

### F-4 Ce qui existe et n'est pas branché

- `alertRecomputeFailed(handle, error)` — **0 appelant**. C'est exactement l'alerte qu'il faudrait sur `computeProceedsForHandle`.
- `alertIngestionFailureSpike(failedCount, windowH)` — **0 appelant**.
- Better Stack : `BETTERSTACK_API_TOKEN` présent en production, `docs/MONITORING.md` décrit 10 monitors et un script de setup. [INDÉTERMINÉ : je ne peux pas vérifier depuis ce poste si ces monitors sont créés et actifs, ni ce qu'ils surveillent. S'ils existent, ils surveillent une disponibilité HTTP, pas une fraîcheur de donnée.]

---

# G — COST WITHOUT VALUE

| Ligne | Coût | Valeur produite | Verdict |
|---|---|---|---|
| API X → `social_post_candidates` | **178,25 $** sur 3 mois [VÉRIFIÉ] | **2** candidats approuvés, 1 rejeté, tous le 2026-06-29 ; 6 667 en `new` | ≈ **89 $ par approbation**. Le goulot est la revue, pas la collecte |
| `helius-scan` quotidien | appels Helius (non ventilés) | 5 handles recalculés sur 400+, chacun via `DELETE` + réinterrogation complète | Recalcul destructif là où un delta suffirait |
| `DomainLabel` | 632 807 lignes de stockage Neon | **aucun consommateur** (Passe A) | À archiver |
| `intel_source_observations` (scamsniffer) | cron quotidien, 260 000 lignes/run annoncées | consommé par `lookupValue` — mais les 2 derniers runs sont `running` à vie, complétude inconnue | Coût payé, résultat non garanti |
| `forta` | — | 3 observations gelées depuis 130 jours, toujours lues comme actuelles | Coût nul, **risque** non nul |
| `/api/kol` sans pagination | calcul Vercel par requête | 20 Ko | Tient à 10 utilisateurs, pas à 1 000 |
| ~80 tables à 0 ligne sur 176 | stockage marginal | — | Coût de maintenance et de confusion |

Aucun chiffre n'est fabriqué ici : les seuls coûts mesurables du dépôt sont ceux de `XApiUsage`. Neon, Vercel, Helius, R2 et Anthropic ne sont ventilés par sous-système nulle part.

---

# H — SURPRISES

> Découvertes non demandées par la checklist.

### H-1 · Le module qui aurait résolu §4 existe, est testé, et n'est appelé par personne

`src/lib/tigerscore/confidence.ts` implémente `« RPC down / missing data → Low, always »`, avec des tests dédiés. **Zéro appelant.** Idem pour `provenance.ts` (`buildProvenance`) et `versioning.ts` (`snapshotScore`).

Trois des quatre modules de qualité du moteur de score sont du code mort. Un audit superficiel qui listerait les fichiers conclurait que le problème est traité. C'est l'illustration la plus nette de *Configured ≠ Running* dans ce dépôt, et elle est trompeuse : **le mieux qu'on puisse faire pour ce système ne serait pas d'écrire ces modules, ils sont écrits.**

### H-2 · Ce qui cassera après trois semaines de bêta, et pas pendant la démo

| Effet | Pourquoi la démo passe | Pourquoi la bêta casse |
|---|---|---|
| Cache d'échec de 10 min (`marketProviders`) | En démo, les fournisseurs répondent | Une coupure de 30 s ⇒ 10 min de scans muets, sur toute l'instance |
| Cache mémoire (`_cache`, `memCache`, `_lastRecompute`, `_kolUpdatedCoalesce`, caches de `/api/scan/eth`, `/api/wallet/scan`, `score-lite`) | Une seule instance chaude | Sur *n* lambdas, les débounces et les coalescings deviennent aléatoires ; le débounce de 5 min du recalcul de proceeds cesse de protéger |
| 12 `new PrismaClient()` + endpoint Neon direct + `statement_timeout = 0` | 13 connexions actives aujourd'hui | Sous concurrence, chaque instance ouvre son pool ; aucune requête lente n'est jamais interrompue |
| `getSignaturesForAddress(limit:20).slice(0,10)`, `wallets.slice(0,5)` | Les KOLs de démo ont peu de transactions | Un KOL actif est structurellement sous-compté, sans que rien ne le dise |
| `/api/kol` sans pagination | 20 Ko | Reconstruction complète par requête |
| Cookie beta accepté en présence, 10 endpoints sans rate-limit | Personne n'essaie | Un seul testeur curieux aspire tout le corpus |

### H-3 · Les conclusions silencieusement fausses

Le cadrage demande : *qu'est-ce qui produit une mauvaise conclusion plutôt qu'une erreur visible ?* Réponse consolidée :

1. Solscan mort ⇒ **token concentré noté comme distribué** (`/api/v1/score`).
2. Helius en 429 ⇒ **montant nominatif public réécrit à la baisse** (proceeds).
3. Binance en panne une minute ⇒ **prix figé sur une constante pour toujours** (PriceCache).
4. Base intelligence indisponible ⇒ **adresse sanctionnée notée comme propre** (le floor 15 disparaît, sortie identique à « aucune correspondance »).
5. `null` de holders ⇒ **`parseFloat(null ?? "0") = 0`** ⇒ aucune claim promue « Corroborated » (`/api/casefile`).
6. Deux KOLs sur le même token ⇒ **`ON CONFLICT (txHash) DO NOTHING`** ⇒ le résumé décrit des événements qui n'ont pas été écrits.

Aucun de ces six cas ne produit d'erreur HTTP, de log d'erreur ou d'alerte. **Les six vont dans le même sens : minorer le risque ou fausser un montant.**

### H-4 · REFLEX V1 code en dur `scam_lineage: "NONE"`

`src/lib/scan/buildTigerInput/solana.ts:51` :

```ts
const scam_lineage: "CONFIRMED" | "REFERENCED" | "NONE" = "NONE";
```

Le commentaire l'assume (« V1 defaults to NONE ; le test de cohérence mocke les deux côtés à NONE »). Conséquence : sur le chemin REFLEX, `scam_lineage_confirmed` (**+70**) et `scam_lineage_referenced` (**+50**) ne se déclenchent **jamais**. Et `top10_holder_pct` n'est pas transmis non plus.

Le test de cohérence qui garantit `score(helper) == score(route)` **verrouille la valeur en dur des deux côtés** : il rend le défaut invisible en le figeant. C'est un test qui protège un bug.

### H-5 · `/api/solana/holders` rend `ok: true` sur une panne totale

```ts
} catch (e) {
  cache.set(mint, { top10_pct: null, … });   // l'échec est mis en cache 5 min
  return NextResponse.json({ ok: true, …, top10_pct: null, holders_source: "unavailable", … });
}
```

Le marqueur est là (`holders_source: "unavailable"`), mais le drapeau de succès ment. Un consommateur qui teste `if (res.ok)` conclut que tout va bien. La route n'a aucun appelant hors test dans le dépôt — c'est une surface publique orpheline.

### H-6 · Ce qui est bien fait, et qu'il faut protéger

Il serait malhonnête de ne lister que les défauts. Ces éléments sont d'un niveau supérieur au reste et doivent servir de modèle :

- **`src/lib/config/envNumber.ts`** — la lecture stricte des entiers d'environnement, avec l'explication de pourquoi `Number.isFinite` ne suffit pas. Famille C close.
- **`src/lib/osint/retail/`** — verrou optimiste, budget re-vérifié avant chaque appel payant, `ERROR_FINAL` vs `ERROR_RETRYABLE` avec tentatives bornées, refus de rejouer un retryable épuisé.
- **`investigators/cases/[caseId]` DELETE** — audit écrit **avant** la suppression, `caseId` nullable pour que le journal survive à la ressource.
- **`src/lib/shill-correlation/process.ts:30`** — `deleteMany` + `createMany` **dans une transaction**. Le seul endroit du dépôt où le motif destructif est fait correctement.
- **`src/lib/risk/exitDoor.ts`** — `data_unavailable` ⇒ `BLOCKED`. La preuve que l'équipe sait faire le bon geste sur l'absence de données.
- **`nominativeApiGate.ts`** — fail-closed, aucune branche `NODE_ENV`, comparaison en temps constant compatible edge, `Vary` et `no-store` sur le refus **et** sur l'autorisation.
- **`intel_ingestion_batches.triggeredBy`** — la seule traçabilité d'origine de run du dépôt.
- **La couverture de tests de la route de dépublication** (Passe A) — 14 tests de refus + 5 mutants tués.

Le problème d'INTERLIGENS n'est pas un manque de savoir-faire. C'est que ce savoir-faire est appliqué de façon très inégale, et **pas sur les chemins qui publient des chiffres nominatifs**.

---

# I — GAP REGISTER

## P0 — BETA INTEGRITY

| ID | Composant | Constat | Preuve | Impact | Dépendances | Retrofit |
|---|---|---|---|---|---|---|
| **B-01** | `/api/kol/[handle]/proceeds` | Le total vient de `KolProfile.totalDocumented`, toutes les métadonnées de `KolProceedsSummary`. bkokoski : 210 900 $ annoncés, 900,06 $ ventilés (×234), `pricingQuality:"high"` | curl production 2026-08-16 ; `route.ts:44-50` | Chiffre nominatif faux publié, réponse auto-contradictoire | B-02, B-03 | HIGH |
| **B-02** | `KolProceedsEvent` | 96–100 % des totaux publiés proviennent de **6 lignes CSV Arkham** sans source, sans preuve, sans relecteur, `walletAddress="ARKHAM-SUMMARY"`, `eventDate` de remplissage, mélangées aux observations on-chain | requête `eventType='SUMMARY_ARKHAM'` | Allégation tierce présentée comme observation documentée | — | HIGH |
| **B-03** | `KolProceedsSummary` | Les événements justifiant le montant n'existent pas : sxyz500 151 vs **1** ; bkokoski 50 vs **5** | jointure summary × count(events) | Montant publié sans preuve en base | B-05, B-06 | HIGH |
| **B-04** | `src/app/api/v1/score` | `public-api.solscan.io` rend **404**. `top10_holder_pct` toujours `null` ⇒ `holders_concentrated_80/60` et `cluster_risk` ne se déclenchent jamais | sonde live | Token concentré noté comme distribué | — | LOW (correctif ponctuel) |
| **B-05** | `src/lib/kol/proceeds.ts` | `DELETE` puis appels réseau puis `INSERT`, **hors transaction**, client Prisma `$disconnect()` en `finally`, débounce mémoire seul | `proceeds.ts:231, 355` | Perte irréversible d'historique sur panne ou concurrence | — | MEDIUM |
| **B-06** | `KolProceedsEvent` | `UNIQUE (txHash)` **global** + `ON CONFLICT DO NOTHING`, résumé calculé depuis la mémoire | `pg_index`, `proceeds.ts:290` | Événements silencieusement abandonnés entre handles | B-03 | MEDIUM |
| **B-07** | `src/lib/kol/proceeds.ts` | Client Helius sans `res.ok`, sans `j.error`, sans retry, sans 429. `null` ⇒ « ce portefeuille n'a rien fait » | `proceeds.ts:38-47` | Une panne fournisseur réécrit un montant public | B-05 | LOW |
| **B-08** | `src/lib/tigerscore/adapter.ts` | `rpc_down` / `rpc_fallback_used` reçus et non transmis au score ni à la confiance. `computeConfidenceLevel` : **0 appelant** | `adapter.ts:7-8, 48-70` ; `engine.ts:301` ; grep | La confiance ne baisse jamais quand la donnée manque | — | LOW |
| **B-09** | `computeTigerScoreWithIntel` | Échec du lookup ≡ adresse propre (sortie identique). Le floor OFAC 15 disparaît en silence | `engine.ts:355-362, 394-403` | Adresse sanctionnée notée propre pendant une panne | — | LOW |
| **B-10** | `KolTokenLink` | 187 `approved_public`, **2** avec `reviewedAt`. `reviewedBy` = `"admin"`. **3** transitions humaines au total, le 2026-06-29 | requêtes | Le contrôle éditorial n'est pas démontrable | B-11 | HIGH |
| **B-11** | `adminAuth.ts` | `admin_session` = HMAC constant de l'env : ni révocable, ni expirable serveur, ni attribuable. `admin_token` = le secret brut en cookie | `adminAuth.ts:148, 200-207` | Aucun relecteur ne peut être nommé | — | HIGH |
| **B-12** | `/api/cron/process-events` | `if (pending.length === 0) return` court-circuite les deux compteurs d'alerte. 160 décisions d'identité en attente depuis 25 j, jamais signalées | `route.ts:59-88` ; requête | L'alerte de backlog est inatteignable en régime stationnaire | — | LOW |
| **B-13** | `src/lib/kol/pricing.ts` | `YEARLY_FALLBACK` en dur ; écrit en cache avec `ON CONFLICT DO NOTHING` ⇒ jamais corrigé. **45 %** du cache. Binance répond 200 aujourd'hui | requête `PriceCache` + sonde Binance | Montants faux jusqu'à ±40 % | B-01 | MEDIUM |
| **B-14** | Gate nominatif + rate-limit | Cookie forgé ⇒ 11 endpoints / ~85 Ko ; **5 des 6** routes nominatives sans rate-limit ; clé IP seule ; aucune trace d'accès | sondes production ; grep | Aspiration non attribuée du corpus nominatif | B-11 | MEDIUM |
| **B-15** | `ScoreSnapshot` | 0 ligne, `snapshotScore` 0 appelant, **14** sites de calcul. Chaque jour ajoute des scores non reconstructibles | grep + requête | Aucune contestation instruisible | — | **VERY HIGH** |
| **B-16** | `EvidenceItem` | **1 070/1 072** en `legacy:` ou `backfill:unknown-operator`, `captureHost` NULL, `provenanceType` NULL, `immutableStored=false` à 100 %, tout en portant un jeton TSA | requête | Chaîne de conservation non défendable | — | **VERY HIGH** |

## P1 — HARDENING BEFORE SCALE

| ID | Composant | Constat | Preuve | Impact | Retrofit |
|---|---|---|---|---|---|
| B-17 | `JobRunLog` | **1** `jobName` sur 22 pipelines ; pas de champ `triggeredBy` ; 32 lignes dont l'origine est indéterminable | requête | Un pipeline mort est invisible | MEDIUM |
| B-18 | `src/lib/ops/alerting.ts` | **3** sites d'appel, tous dans un cron. `alertRecomputeFailed` et `alertIngestionFailureSpike` : 0 appelant. Aucune alerte de type heartbeat | grep | Aucune détection de mort de pipeline | MEDIUM |
| B-19 | `intel_ingestion_batches` | **5/10** batches `running` pour toujours, `errorMessage` NULL, compteurs écrits avant la fin. Les 2 derniers runs scamsniffer | requête | Complétude d'ingestion inconnue | LOW |
| B-20 | `DomainEvent` | `retryCount = 0` sur **3 295** lignes, DLQ jamais déclenché. Backoff 2/10/30 min contre un ordonnanceur quotidien ⇒ retry réel à ~24 h, DLQ à 3 jours | requête + `vercel.json` | Mécanisme non éprouvé, cadence fictive | LOW |
| B-21 | `src/lib/events/processor.ts` | Pas d'état `processing`, pas de `SKIP LOCKED` ; coalescing `kol.updated` en mémoire acquitte sans rebuild au-delà de 3 événements / 2 min | `processor.ts:118-131` | Double traitement, mise à jour perdue | LOW |
| B-22 | `EvidenceLink` / `KolWallet` | Aucune contrainte d'unicité. **34** groupes de liens en doublon, **2** portefeuilles dupliqués en production | requêtes | Preuve comptée deux fois, portefeuille scanné deux fois | LOW |
| B-23 | Tests | `src/lib/kol/` (14 modules) et `src/lib/events/` : **aucun fichier de test**. 0 test de dead-letter, 0 test de concurrence | inventaire | Les chemins les plus destructifs ne sont pas testés | MEDIUM |
| B-24 | Admin | **96 routes mutantes sur 112** n'écrivent aucun audit. `AuditLog` = 0 ligne | grep + requête | Mutations non traçables | MEDIUM |
| B-25 | Prisma / Neon | 12 `new PrismaClient()` hors singleton ; `DATABASE_URL` local = endpoint **direct** sans `connection_limit` ni `pgbouncer=true` alors que `POSTGRES_PRISMA_URL` poolé existe ; `statement_timeout = 0` | grep, `.env.local`, `pg_settings` | Épuisement de connexions, requête runaway non bornée | MEDIUM |
| B-26 | `marketProviders.ts` | Le `nullSnapshot` d'échec est mis en cache 10 min | `marketProviders.ts:183-188` | Une coupure de 30 s ⇒ 10 min de scans dégradés | LOW |
| B-27 | `buildTigerInput/solana.ts` | `scam_lineage` codé `"NONE"` ; `top10_holder_pct` non transmis ; le test de cohérence fige la valeur des deux côtés | `solana.ts:51` | REFLEX ne voit jamais un lignage de scam (+70 / +50 perdus) | LOW |
| B-28 | `/api/casefile` | `case_id` aléatoire par appel, `report_hash` incluant ce hasard et l'horodatage, dossier jamais persisté, `CASE_DB` littéral dans la route | `route.ts:279-298` | Dossier non citable, non comparable, non reconstructible | **VERY HIGH** |
| B-29 | `social_post_candidates` | 6 667 / 7 052 en `new` — état sans propriétaire ni SLA ; 172 en `resolution_pending`, 207 en `needs_review` | requête | File invisible, pas d'échec terminal | LOW |
| B-30 | `price-cache-refresh` | Cron absent de `vercel.json` ; `TokenPriceTracker` gelé **93 j** | fichiers + requête | Suivi de pic périmé | LOW |
| B-31 | `NODE_ENV` | Variable Vercel modifiable pilotant le drapeau `Secure` du cookie admin, `assertProdEnv` et le singleton Prisma | `vercel env ls`, `adminAuth.ts`, `prisma.ts` | Fragilité de sécurité conditionnée à une variable d'exploitation | LOW |
| B-32 | `/api/solana/holders` | Rend `ok: true` sur panne totale et met l'échec en cache 5 min ; aucun appelant hors test | `route.ts:36-38` | Surface publique orpheline au drapeau menteur | LOW |

## P2 — POST-BETA

| ID | Composant | Constat | Retrofit |
|---|---|---|---|
| B-33 | Schéma | **339** colonnes `timestamp` naïves / **72** aware, sur 144 et 29 tables. `XApiUsage.monthStart` déjà écrit en heure de Paris | HIGH |
| B-34 | `KolProfile` | Aucun chemin outillé `published → draft` ; publier reste un acte à effet de levier ×53 | MEDIUM |
| B-35 | `KolProceedsSummary` | `methodologyVersion` = littéral `'v1'` dans le SQL ; `coverageStatus='partial'` sur 28/28 sans conséquence à l'affichage | MEDIUM |
| B-36 | `Retraction` / `ContradictionAlert` | 0 ligne. `kol.updated`, `wallet.linked`, `casefile.ingested` jamais émis ⇒ 3 des 6 types gérés sont morts | MEDIUM |
| B-37 | Volumétrie | ~80 tables sur 176 à 0 ligne ; `DomainLabel` 632 807 lignes sans consommateur | LOW |
| B-38 | `/api/kol` | Aucune pagination ; reconstruction complète du snapshot par requête | LOW |
| B-39 | `proceeds.ts` | Plafonds silencieux : `slice(0,5)` portefeuilles (commentaire annonce 10), `limit:20` puis `slice(0,10)` signatures ⇒ **50 tx max par KOL**, `walletCount:113` annoncé | MEDIUM |
| B-40 | `EvidenceItem` | Horodatage TSA hors du chemin d'ingestion : 2 items ingérés après le 2026-07-30 restent non horodatés | LOW |
| B-41 | Docs | `sync-proceeds/route.ts:6` annonce helius-scan « every 12h » ; `vercel.json` dit `0 4 * * *`. `CLAUDE.md` annonce « port 6543 pgbouncer » ; `DATABASE_URL` local est l'endpoint direct | LOW |

---

# J — NON COUVERT

Ce qui n'a **pas** été traité dans cette passe, et pourquoi.

### J-1 Impossible à vérifier depuis ce poste

| Sujet | Raison |
|---|---|
| Valeurs des variables d'environnement de production | Toutes chiffrées dans `vercel env ls` ; `vercel env pull` interdit par la règle du dépôt. Les conclusions sur `DATABASE_URL` (endpoint direct, absence de `connection_limit`) reposent sur `.env.local` et sont marquées **INDÉTERMINÉ en production** |
| État réel des monitors Better Stack | `BETTERSTACK_API_TOKEN` présent, `docs/MONITORING.md` décrit 10 monitors et un script de setup ; leur existence et leur portée effectives ne sont pas vérifiables d'ici |
| Logs runtime Vercel | Hors fenêtre de rétention pour les incidents étudiés (avril–juillet). Toutes les conclusions temporelles viennent de la base, pas des logs |
| Contenu du bucket R2 | Aucune sonde effectuée. `immutableStored=false` est lu en base, pas vérifié côté R2 |
| Le 403 Cloudflare sur les pages (Passe A, point humain n°7) | Nécessite un navigateur non challengé |
| Coûts Helius / Neon / Vercel / R2 / Anthropic | Aucune ligne de facturation par sous-système n'existe dans le dépôt. **Aucun chiffre n'a été fabriqué** — seul `XApiUsage` est mesuré |

### J-2 Volontairement hors périmètre

| Sujet | Raison |
|---|---|
| **Conception d'une solution de versioning de score** | Explicitement réservé à la passe dédiée (§4 du cadrage). Seuls les dépendances, les risques et les données perdues sont documentés (B-15, D-1) |
| Sujets clos par la Passe A | Crons manquants, `process-queue`, `ERROR_RETRYABLE`, `identity.review_required`, fraîcheur OFAC, Evidence/EvidenceLink, routes d'écriture, isolation Preview→prod, Watcher/X API, modules orphelins — rouverts uniquement là où ils sont dépendance d'un constat B (B-12 pour l'identité, §C-5.1 pour `social_posts` / `KolTokenInvolvement`) |
| Toute correction, tout code, toute migration | Passe READ-ONLY |

### J-3 Couvert partiellement

| Sujet | Ce qui manque |
|---|---|
| **§14 Tests** | Couverture mesurée par recherche de motifs sur 184 fichiers et par absence de fichier pour les modules critiques. **La suite n'a pas été exécutée** (`pnpm test`) : je ne peux pas affirmer que les 1 141 tests de la baseline passent aujourd'hui |
| **§4 Fournisseurs** | Sondés en direct : Solscan (404), DexScreener, GeckoTerminal, Binance, RPC Solana public, `ethereum.publicnode.com` (tous 200). **Non sondés** : Helius, Etherscan, Alchemy, Birdeye, Resend, Telegram, Upstash, freetsa.org — leurs clés sont en production et je n'ai pas voulu les consommer depuis ce poste |
| **§3 Concurrence** | Analysée statiquement (verrous, contraintes, transactions, caches mémoire). **Aucun test de charge ni exécution concurrente** n'a été lancé contre la production |
| **§10 IDOR** | Testé sur le chemin vault investigateur (401 avec cookie forgé, `assertCaseOwnership` lu). **Non testé exhaustivement** sur les 362 routes du dépôt |
| **§15 Coût** | Seul le poste X est chiffré. Le reste est un constat d'absence de mesure, pas une mesure |
| **MM_TRACKER, RWA, Billing, Telegram, Security Center** | Traités uniquement par la volumétrie et la fraîcheur (§C-5, §G). Leur logique interne n'a pas été auditée — ils n'apparaissaient dans aucun des chemins nominatifs prioritaires |

### J-4 Une réserve de méthode

Les conclusions temporelles reposent sur la base. La base dit ce qui a été **écrit**, pas ce qui a été **tenté**. Un cron qui s'exécute et ne produit rien est, dans 21 pipelines sur 22, indiscernable d'un cron qui ne s'exécute pas — c'est précisément le constat B-17, et c'est aussi la limite de cet audit.

---

*Rapport produit en lecture seule le 2026-08-16. Aucune écriture, aucune migration, aucun correctif. Toutes les requêtes SQL ont été exécutées sous `SET default_transaction_read_only = on` contre `ep-square-band`. Toutes les sondes production sont des `GET`.*
