# AUDIT SCHEMA INTEGRITY — P1

**Date des mesures :** 2026-08-25, 07:07–07:40 UTC
**Base :** `ep-square-band` (pooler 6543), session `default_transaction_read_only = on` — vérifié avant chaque lot (`SHOW default_transaction_read_only` → `on`). Le script de mesure refuse de se connecter si l'hôte ne matche pas `ep-square-band` (sortie 1).
**Mode :** LECTURE SEULE STRICTE. Aucune écriture, aucune migration exécutée, aucun `prisma migrate` / `db push` / `db:status`, aucun `vercel env pull`. Aucun secret dans ce document.
**Parent :** `docs/prep/AUDIT_SCHEMA_INTEGRITY_2026-08-22.md` — dont ce rapport **clôt UNKNOWN-3** et **corrige BUG-2**.

---

## 0. Ce que cet audit change par rapport au rapport du 22 août

| | rapport du 2026-08-22 | mesure du 2026-08-25 |
|---|---|---|
| **SI-01** `now()` nu | « non recensé exhaustivement, 63 appels » → UNKNOWN-3 | **recensé : 75 sites temporels, 100 % classés** |
| **SI-02** `WatchScan` | BUG — Prisma ne décrit pas la table | **CONFIRMÉ à l'identique**, + consommateurs tracés (lecture live, mais inoffensive) |
| **SI-03** `VaultProfile` | BUG — « 5 colonnes `text[]` déclarées `String` » | **NE SE REPRODUIT PAS. Faux positif.** Prisma déclare bien `String[]` sur les 4 colonnes réelles, et la colonne `tags` citée **n'existe ni en base ni dans le modèle** |
| **Bonus** chunker | — | **dérive confirmée** : les 7 colonnes sont en prod, `schema.prod.prisma` et l'en-tête de `chunkerStore.prisma.ts` affirment le contraire |
| **Nouveau** | — | **`wallet_sync_state` n'existe pas en base** et 6 sites SQL l'interrogent |
| **Nouveau** | — | **3 modèles Prisma sans table**, dont `AdminDocument` **appelé par 5 sites** (routes admin qui lèvent) |

Trois sous-défauts, trois criticités distinctes. **Aucune synchronisation Prisma en bloc n'est proposée** : chacun se corrige séparément, et les consommateurs ont été vérifiés avant toute proposition.

---

# SI-01 — Sémantique temporelle du SQL brut

## 1.1 La règle de classement, posée avant les résultats

Trois faits mesurés le 2026-08-25 encadrent tout le reste :

1. **Le serveur est en `GMT`** — `current_setting('TimeZone')` = `GMT`. Donc `now()::timestamp` rend de l'UTC.
2. **La base est majoritairement naïve** — **341** colonnes `timestamp without time zone` contre **72** `timestamp with time zone`, sur 413.
3. **`now()` rend un `timestamptz`.** L'écrire dans une colonne naïve force une conversion en heure murale **du fuseau de session**.

D'où le classement, appliqué site par site :

| verdict | condition | pourquoi |
|---|---|---|
| **EXPECTED** | expression `timestamptz` → colonne `timestamptz`, **ou** expression déjà naïve-UTC (`now() at time zone 'utc'`) → colonne naïve | correct **par construction**, invariant par fuseau |
| **LEGACY** | comparaison en LECTURE entre une colonne naïve et une expression `timestamptz` | correct aujourd'hui, dépendant du fuseau, **n'écrit rien** |
| **BUG** | ÉCRITURE d'une expression `timestamptz` (`now()`, `NOW()`, `$n::timestamptz`) dans une colonne **naïve** | la valeur stockée dépend du `TimeZone` de session |

## 1.2 Recensement — 75 sites, 38 fichiers, 100 % classés

Méthode : balayage de `src/**/*.{ts,tsx,mjs}` hors tests, sur `now()` / `NOW()` (hors `Date.now` et `performance.now`), `::timestamptz`, `AT TIME ZONE`, `date_trunc`, `interval '`, `CURRENT_TIMESTAMP` ; puis remontée jusqu'au `INSERT INTO` / `UPDATE` / `FROM` englobant pour identifier la table ; puis lecture manuelle de la liste de colonnes de chaque `INSERT` positionnel ; puis croisement avec `information_schema.columns`.

> Le chiffre « 63 appels `executeRaw` » du rapport parent est un dénombrement d'appels, pas de sites temporels. Compte réel du dépôt hors tests : **119** sites de SQL brut, dont **53** de la famille `executeRaw` et **66** de la famille `queryRaw`. Sur ces 119, **75 manipulent le temps** — c'est ce périmètre-là qui est classé ici.

| verdict | sites | tables distinctes |
|---|---|---|
| **BUG** | **31** | 13 |
| **LEGACY** | **7** | 6 |
| **EXPECTED** | **37** | 10 |

### BUG — 31 sites (écriture `timestamptz` → colonne naïve)

| # | site | colonne(s) cible(s) | type réel | lignes en base | note |
|---|---|---|---|---|---|
| 1 | `src/lib/intelligence/ingest.ts:249` | `intel_canonical_entities` `firstSeenAt`/`lastSeenAt`/`createdAt`/`updatedAt` | NAIF | 340 520 | déjà connu (parent §2.2) |
| 2 | `ingest.ts:257` | `intel_canonical_entities.lastSeenAt` | NAIF | 340 520 | idem |
| 3 | `ingest.ts:259` | `intel_canonical_entities.updatedAt` | NAIF | 340 520 | idem |
| 4 | `ingest.ts:280` | `intel_source_observations` `ingestedAt`/`observedAt` | NAIF | 340 523 | idem |
| 5 | `ingest.ts:295` | `intel_source_observations.lastVerifiedAt` | NAIF | 340 523 | idem |
| 6 | `src/lib/osint/review/prismaReviewStore.ts:93` | `SignalIntake` `reviewedAt` (`$4::timestamptz`) **et** `updatedAt` (`now()`) | NAIF | 172 | le parent n'avait vu que `reviewedAt` |
| 7 | `prismaReviewStore.ts:103` | `KolTokenLink.reviewedAt` | NAIF | 292 | déjà connu |
| 8 | `src/lib/watcher-bridge/reviewDraftLink.ts:101` | `KolTokenLink.reviewedAt` | NAIF | 292 | **nouveau** |
| 9 | `reviewDraftLink.ts:158` | `KolTokenLink.reviewedAt` | NAIF | 292 | **nouveau** |
| 10 | `src/lib/watcher-bridge/archiveLinkPublication.ts:221` | `KolTokenLink.reviewedAt` | NAIF | 292 | **nouveau** |
| 11 | `src/lib/watcher-bridge/candidateStateMachine.ts:126` | `social_post_candidates.updatedAt` | NAIF | 7 353 | **nouveau** |
| 12 | `src/lib/watcher-bridge/runBridgeJob.ts:48` | `JobRunLog.finishedAt` | NAIF | 134 | **nouveau** |
| 13 | `runBridgeJob.ts:66` | `JobRunLog.finishedAt` | NAIF | 134 | **nouveau** |
| 14 | `src/app/api/cron/watcher-v2/route.ts:76` | `XApiUsage.updatedAt` | NAIF | 3 | **nouveau** — chemin gelé |
| 15 | `watcher-v2/route.ts:81` | `XApiUsage.updatedAt` | NAIF | 3 | **nouveau** — chemin gelé |
| 16 | `src/app/api/cron/daily-flow/route.ts:263` | `KolProceedsSummary.lastFlowComputedAt` | **NAIF** | — | **nouveau**, et voir 1.3 |
| 17 | `src/scripts/apply-vetting-decisions.ts:38` | `KolProfile.deactivatedAt` | NAIF | 411 | **nouveau** — script |
| 18 | `src/scripts/standby-low-follower-kols.ts:212` | `KolProfile.deactivatedAt` | NAIF | 411 | **nouveau** — script |
| 19 | `src/lib/osint/evidenceCommitBridge.ts:152` | `EvidenceLink.createdAt` | NAIF | 1 089 | **nouveau** |
| 20 | `src/lib/osint/retail/retailStore.ts:387` | `EvidenceLink.createdAt` | NAIF | 1 089 | **nouveau** |
| 21 | `src/scripts/night-vetting.ts:248` | `CREATE TABLE … TIMESTAMP(3) DEFAULT now()` | NAIF | — | **nouveau** — crée le défaut fautif |
| 22 | `src/lib/surveillance/alerts/deliverAlerts.ts:102` | `alert_deliveries` `deliveredAt`/`createdAt` | NAIF | **0** | sous-système mort (1.5) |
| 23 | `deliverAlerts.ts:108` | `alert_deliveries.createdAt` | NAIF | **0** | idem |
| 24 | `src/lib/surveillance/reports/generateCaseFile.ts:211` | `casefiles` `generatedAt`/`createdAt` | NAIF | **0** | idem |
| 25 | `generateCaseFile.ts:216` | `casefiles.generatedAt` | NAIF | **0** | idem |
| 26 | `src/lib/surveillance/signals/recidivismScore.ts:47` | `influencer_scores.updatedAt` | NAIF | **0** | idem |
| 27 | `recidivismScore.ts:54` | `influencer_scores.updatedAt` | NAIF | **0** | idem |
| 28 | `src/lib/surveillance/signals/detectSellWhileShilling.ts:127` | `signals.createdAt` | NAIF | **0** | idem |
| 29 | `src/lib/surveillance/onchain/ingest.ts:98` | `onchain_events.createdAt` | NAIF | **0** | idem |
| 30 | `onchain/ingest.ts:137` | `wallet_sync_state.lastSyncAt` | — | **table absente** | voir 1.6 |
| 31 | `onchain/ingest.ts:140` | `wallet_sync_state.lastSyncAt` | — | **table absente** | voir 1.6 |

**Répartition par gravité réelle :** 8 sites écrivent dans des tables mortes (0 ligne), 2 visent une table inexistante, 2 sont des scripts manuels. **Il reste 19 sites sur des tables vivantes**, dont 5 déjà connus. **14 sites vivants sont nouveaux.**

### LEGACY — 7 sites (comparaison en lecture, aucune écriture)

| site | expression | verdict |
|---|---|---|
| `src/lib/billing/cap.ts:33` | `"reservationExpiresAt" > NOW()` — `BetaFounderAccess` NAIF | LEGACY — promotion naïf→tz au fuseau de session |
| `src/lib/watcher-bridge/promoteWatcherSignalsToDraft.ts:378` | `coalesce(postedAtUtc, discoveredAtUtc) >= now() - (…)::interval` — NAIF | LEGACY — la fenêtre glisse avec le fuseau |
| `src/scripts/watchdog/watcher-health.mjs:391` | `"startedAt" < now() - interval '1 hour'` — NAIF | LEGACY |
| `watcher-health.mjs:324` | `(now()::date - max("ingestedAt")::date)` — NAIF | LEGACY — l'âge en jours dépend du fuseau |
| `src/app/api/admin/stats/route.ts:76` | `date_trunc('day', "createdAt")` — `ask_logs` NAIF | LEGACY — bucket journalier en heure murale stockée |
| `src/lib/reflex/metrics.ts:107` | `date_trunc('day', "createdAt")` — `ReflexAnalysis` NAIF | LEGACY |
| `src/app/api/admin/onchain/status/route.ts:13` | `"lastSyncAt" > NOW() - INTERVAL '24 hours'` | LEGACY **et** table absente (1.6) |

### EXPECTED — 37 sites

Deux familles, toutes deux correctes **par construction** :

**a) Colonne réellement `timestamptz` (33 sites).** `TokenPriceTracker` (5), `EvidenceSnapshot` (5), `OsintSubmission` (9), `KolProceedsEvent` (4), `KolProceedsSummary` (5), `Retraction` (2), `ContradictionAlert`, `KolCrossLink`, `SerialPattern`, `WatcherCampaign`, `OsintReviewAudit`. Sur ces colonnes le cast `::timestamptz` n'est pas seulement correct, il est **nécessaire** — le retirer casserait la sémantique.

**b) Expression déjà naïve-UTC vers colonne naïve (4 sites).** `date_trunc('month', (now() at time zone 'utc'))` :
`watcher-v2/route.ts:75` et `:143`, `watcher-health.mjs:222`, et le mécanisme repris par `chunkerStore.prisma.ts`.
**C'est la forme correcte, et elle est déjà employée dans le dépôt** — la correction de SI-01 n'a donc rien à inventer, seulement à la généraliser.

## 1.3 Le cas qui résume tout : deux verdicts dans la même requête

`src/app/api/cron/daily-flow/route.ts:255-265`, un seul `UPDATE` :

```sql
UPDATE "KolProceedsSummary"
   SET …,
       "lastFlowComputedAt" = NOW(),   -- colonne NAIVE   → BUG
       "updatedAt"          = NOW()    -- colonne TIMESTAMPTZ → EXPECTED
 WHERE "kolHandle" = $1
```

Deux colonnes voisines de la même table, deux types différents, la même expression — un verdict opposé sur chacune. C'est la preuve la plus courte que **ce défaut ne peut pas se corriger par un remplacement global `now()` → `SQL_NOW_UTC`** : appliqué à `updatedAt`, ce remplacement écrirait de l'heure murale dans une colonne `timestamptz`, et **créerait** un bug là où il n'y en avait pas. La correction doit se faire **colonne par colonne, avec le type réel sous les yeux**.

## 1.4 Un BUG côté client, invisible en SQL — le watchdog se trompe de 8 heures

Distinct du précédent : il ne concerne pas l'écriture mais la **relecture en JavaScript**.

`src/scripts/watchdog/watcher-health.mjs` est le seul consommateur du dépôt qui parle à Postgres via `pg` en direct (tout le reste passe par Prisma). Son check n°1 fait :

```js
const r = await client.query(`SELECT MAX("discoveredAtUtc") AS last FROM social_post_candidates …`);
const last = new Date(r.rows[0].last).getTime();
```

`social_post_candidates.discoveredAtUtc` est **`timestamp without time zone`** (mesuré). `pg` construit alors une `Date` en interprétant l'heure murale dans le **fuseau local du process Node**.

**Preuve directe, produite par cette session.** La même ligne `JobRunLog`, lue deux fois :

```
valeur stockée (::text)             2026-08-25 07:06:32.760255
objet Date rendu par pg (machine en CEST, UTC+2)   2026-08-25T05:06:32.760Z
```

Deux heures d'écart, sur la même ligne, sans qu'aucune requête ne change.

**Conséquence sur Host-001 (Lombok, UTC+8) :** l'âge calculé par le watchdog est **surestimé de 8 h**. Le sens du décalage est heureux — la sonde alerte trop tôt, jamais trop tard — mais le nombre affiché dans l'alerte Telegram est faux, et le seuil annoncé « 3,5 j » se déclenche en réalité à **3,17 j**.

**Le chemin Prisma est indemne**, mesuré par le rapport parent (§2.3) : Prisma relit une colonne naïve comme de l'UTC quel que soit le fuseau, client ou session. Ce défaut est donc **strictement borné à `watcher-health.mjs`**.

*Correction proposée :* poser `TZ=UTC` dans le `plist` launchd du watchdog, **ou** — plus robuste, parce qu'indépendante de l'environnement — demander le texte au serveur : `to_char(MAX("discoveredAtUtc"), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`. `src/scripts/` n'est pas un chemin gelé.

## 1.5 Le sous-système `surveillance/` est mort — 8 des 31 BUG sont dormants

Volumes mesurés : `signals` **0**, `onchain_events` **0**, `alert_deliveries` **0**, `casefiles` **0**, `influencer_scores` **0**. Cinq tables, zéro ligne, alors que le code qui les alimente existe et compile.

Ces 8 sites restent des BUG (le code est faux), mais leur criticité est **basse** : aucune donnée n'est en jeu, et le sous-système devrait être tranché (réactivé ou retiré) avant qu'on dépense un correctif dessus. Ce n'est pas une décision d'audit.

## 1.6 NOUVEAU — `wallet_sync_state` n'existe pas

```
SELECT count(*) FROM information_schema.tables
 WHERE table_schema='public' AND table_name='wallet_sync_state';   →  0
```

**6 sites SQL l'interrogent :** `src/app/api/admin/onchain/status/route.ts:12,16` (2 `SELECT`, route admin **live**) et `src/lib/surveillance/onchain/ingest.ts:114,136,148,183` (3 `INSERT`/`UPDATE` + 1 `SELECT`).

La route `/api/admin/onchain/status` lève donc `relation "wallet_sync_state" does not exist` **à chaque appel**. Même famille que `Exhibit` (modèle sans table, LEGACY-1 du parent), mais **dans l'autre sens et plus grave** : ici du code appelant existe et est exposé en admin.

**Classement : BUG.** Criticité : moyenne — la surface est une route admin, pas un chemin retail, et le sous-système est mort par ailleurs (1.5).

## 1.7 Correction proposée pour SI-01 — **elle existe déjà, non fusionnée**

La branche **`feat/cc-offline-97-timezone-utc`** (commit `f6aac04`) porte :

- `src/lib/intelligence/sqlTime.ts` — `SQL_NOW_UTC = "(now() AT TIME ZONE 'UTC')"` + un littéral UTC invariant, avec la table de mesure des 4 fuseaux en commentaire ;
- `src/lib/intelligence/ingest.ts` corrigé ;
- `__tests__/security/intel-ingest-timezone.test.ts`.

**Elle ne couvre que `ingest.ts`** — soit **5 des 31 BUG**. Les 26 autres sont hors de son périmètre.

Séquence proposée, **rien n'étant appliqué ici** :

| étape | portée | chemin gelé ? |
|---|---|---|
| 1 | Fusionner `feat/cc-offline-97-timezone-utc` (5 BUG fermés) | non |
| 2 | Promouvoir `sqlTime.ts` hors de `src/lib/intelligence/` (p. ex. `src/lib/sql/sqlTime.ts`) — il n'a rien de spécifique à l'intel | non |
| 3 | 12 BUG dans `src/lib/watcher-bridge/`, `src/lib/osint/`, `src/scripts/` | non — corrigeables sur branche |
| 4 | 2 BUG dans `src/app/api/cron/watcher-v2/route.ts` (`XApiUsage.updatedAt`) | **OUI** → `.patch` + exemption |
| 5 | 1 BUG dans `src/app/api/cron/daily-flow/route.ts` (`lastFlowComputedAt` **seulement**, cf. 1.3) | **OUI** → `.patch` + exemption |
| 6 | 8 BUG du sous-système mort | à trancher d'abord (1.5) |
| 7 | `wallet_sync_state` | décision : créer la table ou retirer le code |
| 8 | Le BUG client de `watcher-health.mjs` (1.4) | non |

> **Je n'ai produit aucun de ces `.patch` dans cette session.** Les étapes 4 et 5 touchent `src/app/api/cron/watcher-v2/route.ts`, c'est-à-dire **la fenêtre sensible que la consigne interdit d'ouvrir sans le fondateur**. Les étapes 1–3 et 8 sont des chantiers propres à lancer sur branche dédiée, chacun avec ses tests — pas un remplacement global (1.3).

## 1.8 NOUVEAU — trois modèles Prisma sans table, dont un **appelé en production**

En élargissant le contrôle « modèle sans table » que le parent avait posé sur `Exhibit` (LEGACY-1), balayage des **160 modèles** de `schema.prod.prisma` contre les **178 tables** de `public` :

| modèle Prisma | table en base | appelé par du code ? | verdict |
|---|---|---|---|
| `Exhibit` | **absente** | `prisma.exhibit` → **0 site** | LEGACY — modèle mort, inoffensif |
| `CasefileDraft` | **absente** | `prisma.casefileDraft` → **0 site** | LEGACY — modèle mort, inoffensif |
| `AdminDocument` | **absente** | `prisma.adminDocument` → **5 sites** | **BUG** |

Les 5 sites d'`AdminDocument` :

```
src/app/api/admin/documents/route.ts       findMany   create
src/app/api/admin/gtm/configure/route.ts   findFirst  update  create
```

Prisma émet un `SELECT … FROM "AdminDocument"` sur une relation qui n'existe pas. Les deux routes attrapent l'erreur (`try/catch`) et rendent un **`500 list_failed`** au lieu de planter le process : le défaut est donc **total mais silencieux côté logs applicatifs** — `/api/admin/documents` ne renverra jamais un document, et `/api/admin/gtm/configure` n'enregistrera jamais rien. Exactement le même défaut que `wallet_sync_state` (§1.6), mais par l'ORM au lieu du SQL brut, et sur des routes d'écriture.

Ce contrôle « modèle sans table » **n'est pas dans le périmètre SI-01/02/03**, mais il tombe sous le même invariant SCHEMA INTEGRITY et coûtait une requête. Il est rapporté ici plutôt que perdu.

**Classement : BUG**, criticité **moyenne** — routes admin seulement, mais 3 des 5 appels sont des chemins d'écriture, et l'échec est total (pas dégradé). **Correction : décision fondateur** — créer les tables, ou retirer modèles et routes. Rien n'est proposé en dur : les deux issues sont défendables et le choix dépend de si `/admin/documents` doit exister.

---

# SI-02 — `WatchScan` : le modèle Prisma ne décrit pas la table

## 2.1 Confirmation — mesure du 2026-08-25

| `schema.prod.prisma` (l.821) | base réelle |
|---|---|
| `id` String | `id` text ✅ |
| `createdAt` DateTime | `createdAt` timestamp NAIF, déf. `CURRENT_TIMESTAMP` ✅ |
| `status` String déf. `"pending"` | `status` text déf. **`'ok'`** ⚠️ |
| `handle` String | **absente** |
| `postsFound` Int | **absente** |
| `postsArchived` Int | **absente** |
| `errorMessage` String? | **absente** (mais `errorMsg` text existe) |
| `durationMs` Int? | **absente** |
| `triggeredBy` String | **absente** |
| — | `sourceId` text **NOT NULL, sans défaut** |
| — | `scannedAt` timestamp **NOT NULL**, déf. `CURRENT_TIMESTAMP` |
| — | `newPosts` integer **NOT NULL**, déf. `0` |
| — | `errorMsg` text |

**Recouvrement : `id`, `status`, `createdAt`. Rien d'autre.** Deux tables différentes portant le même nom. Volume : **0 ligne.**

Le même modèle figure à l'identique dans `prisma/schema.prisma` (l.681) — la divergence est donc dans **les deux** schémas.

## 2.2 Consommateurs — vérifiés un par un

| site | opération | colonnes touchées | survit ? |
|---|---|---|---|
| `src/lib/admin/stats.ts:129,130,178,179,180,251,297,298` | `prisma.watchScan.count({where:{createdAt}})` ×8 | `createdAt` | **OUI** |
| `src/lib/admin/stats.ts:199` | `findMany({where:{createdAt}, select:{createdAt:true}})` | `createdAt` | **OUI** |
| — | aucune écriture ORM | — | — |

**Aucun consommateur ne touche une colonne absente.** Les 9 lectures ne sélectionnent que `createdAt`, qui existe : le SQL généré par Prisma est valide et ne lève pas. Ces lectures sont **live** — elles alimentent `/admin/stats` via `/api/admin/stats`.

**Conséquence silencieuse, mesurée :** la table étant vide, tous les compteurs « scans » du tableau de bord admin valent **0 en permanence**, et le graphique 30 jours est plat. Ce n'est pas une panne visible — c'est un cadran qui affiche zéro et qu'on lit comme « rien à signaler ».

## 2.3 Classement et correction proposée

**BUG**, criticité **basse** : 0 ligne, aucun écrivain, aucune lecture cassée. Mais c'est une **bombe à retardement** — la première écriture ORM `prisma.watchScan.create()` échouerait sur `sourceId` et `scannedAt`, tous deux `NOT NULL` sans défaut que Prisma ne fournirait jamais.

**Correction proposée : ALIGNER LE MODÈLE SUR LA TABLE, pas l'inverse.** La table réelle décrit un « scan de source » (`sourceId`, `scannedAt`, `newPosts`) et c'est elle qui porte les contraintes. Aucune migration n'est nécessaire.

```prisma
// PROPOSITION — NON APPLIQUÉE. prisma/ est un chemin GELÉ → .patch + exemption.
model WatchScan {
  id        String   @id @default(cuid())
  sourceId  String
  scannedAt DateTime @default(now())
  status    String   @default("ok")     // et non "pending"
  newPosts  Int      @default(0)
  errorMsg  String?
  createdAt DateTime @default(now())

  @@index([sourceId])
  @@index([createdAt])
}
```

⚠️ **Ce changement casserait le typecheck de `src/lib/admin/stats.ts` ? Non — vérifié :** les 9 sites ne référencent que `createdAt`, conservé. Le modèle corrigé est donc compatible avec 100 % des consommateurs actuels.

⚠️ **Reste non tranché (hérité d'UNKNOWN-1 du parent) :** *quel producteur* était censé écrire `handle` / `postsFound` / `postsArchived` ? Si un composant du Watcher V1 (Host-005) attend cette forme-là, aligner le modèle sur la table le condamnerait définitivement. Le modèle proposé ci-dessus suppose que la **table** fait autorité. **C'est une décision fondateur, pas une décision d'audit.**

`prisma/` étant gelé, aucune modification n'a été faite. Le bloc ci-dessus est du texte à valider.

---

# SI-03 — `VaultProfile` : **le défaut ne se reproduit pas**

## 3.1 Mesure

`information_schema.columns` sur `VaultProfile`, 2026-08-25 — **19 colonnes**, dont 4 tableaux :

| colonne | Postgres réel | `schema.prod.prisma` (l.1715) | verdict |
|---|---|---|---|
| `languages` | `ARRAY` / `_text` | **`String[]`** | **conforme** |
| `specialties` | `ARRAY` / `_text` | **`String[]`** | **conforme** |
| `coverageZones` | `ARRAY` / `_text` | **`String[]`** | **conforme** |
| `badges` | `ARRAY` / `_text` | **`String[]`** | **conforme** |
| `tags` | **n'existe pas** (`count = 0`) | **n'existe pas** | — |

Le modèle Prisma déclare exactement les 19 colonnes réelles, ni plus ni moins (les 3 champs restants — `nda`, `workspace`, `audits` — sont des relations, pas des colonnes).

## 3.2 Le constat parent était faux, et il n'a pas été « corrigé depuis »

`git log -L 1715,1740:prisma/schema.prod.prisma --since=2026-08-15` → **aucun commit**. Le bloc `VaultProfile` n'a pas bougé entre la mesure du 21 août et celle d'aujourd'hui : le rapport du 22 août décrivait donc **déjà** un fichier qui disait `String[]`.

Signature probable : un parseur de schéma Prisma qui perd le suffixe `[]` (rendant `String[]` → `String`) et qui, appliqué à la mauvaise table, a fait apparaître un `tags` qui n'existe nulle part sur `VaultProfile`. La nullabilité annoncée (« Prisma requis / PG nullable ») allait dans le même sens : `String[]` est non-null côté Prisma et nullable côté PG **par construction**, ce n'est pas une divergence.

## 3.3 Vérification élargie — le défaut existe-t-il ailleurs ?

Puisque le constat était mal localisé, j'ai balayé **tout le schéma** plutôt que la seule table citée : 34 champs Prisma « à allure de tableau » (`String[]`, ou `String @default("[]"/"{}")`), croisés avec leur type réel.

**Résultat : aucun champ `String` n'est un `text[]` réel, et aucun `String[]` n'est autre chose qu'un `_text`.** Les 20 `String[]` correspondent tous à un `ARRAY`/`_text` ; les 14 `String @default("[]")` correspondent tous à un `text`, **à une exception près** :

| table | colonne | Prisma | Postgres | verdict |
|---|---|---|---|---|
| `social_post_candidates` | `detectedTokens` | `String @default("[]")` | **`jsonb`** | **BUG** — dette déjà répertoriée |
| `social_post_candidates` | `detectedAddresses` | `String @default("[]")` | `text` | **conforme** |

> Note pour la mémoire projet : la dette est souvent citée comme portant sur **`detectedTokens` ET `detectedAddresses`**. Mesuré ce jour : **seul `detectedTokens` est `jsonb`**. `detectedAddresses` est bien du `text`. Le contournement `$queryRawUnsafe` reste justifié pour la première, pas pour la seconde.

## 3.4 Classement

**SI-03 : AUCUN DÉFAUT.** Aucune correction à proposer, aucun `.patch`, aucun changement de schéma. Le sous-défaut se ferme.

La seule divergence tableau/scalaire du schéma entier est `detectedTokens` (1 colonne, déjà connue, déjà contournée).

---

# BONUS — dérive `schema.prod.prisma` sur le chunker

## 4.1 La migration EST passée en production

Mesuré le 2026-08-25 sur `intel_ingestion_batches` :

| élément | attendu par `MIGRATION_CHUNKER_2026-08-22.sql` | mesuré en prod |
|---|---|---|
| `cycleId` text nullable | ✅ | **présent** |
| `chunkIndex` integer nullable | ✅ | **présent** |
| `sourceVersion` text nullable | ✅ | **présent** |
| `startOffset` integer nullable | ✅ | **présent** |
| `cursorNext` integer nullable | ✅ | **présent** |
| `anchorKey` text nullable | ✅ | **présent** |
| `processedCount` integer nullable | ✅ | **présent** |
| index `…_cycleId_chunkIndex_idx` | ✅ | **présent** |
| index `…_sourceSlug_cycleId_idx` | ✅ | **présent** |

**7 colonnes sur 7, 2 index sur 2.** La migration additive a bien été appliquée à la main.

## 4.2 Deux endroits affirment le contraire

**a) `prisma/schema.prod.prisma:1109-1127`, `model IntelIngestionBatch`** — déclare 12 champs, **aucune** des 7 colonnes, et **aucun** des 2 index. Il décrit la table d'avant la migration.

**b) `src/lib/intelligence/chunkerStore.prisma.ts` (branche `feat/cc-offline-98-chunker-scamsniffer`, commit `24152ce`), en-tête, ligne 4-5** :

> `⚠️ INERTE TANT QUE LA MIGRATION ADDITIVE N'EST PAS PASSÉE À LA MAIN.`
> `Les 7 colonnes ci-dessous n'existent pas encore sur ep-square-band ;`

**Cette affirmation est fausse depuis que la migration est passée.** Elle était vraie à l'écriture (2026-08-21) ; elle ne l'est plus.

## 4.3 État réel du chunker

```
intel_ingestion_batches : 28 lignes,  0 avec cycleId,  dernière createdAt 2026-08-25 01:30:28
```

Les colonnes existent, **personne n'écrit dedans** : le code du chunker vit sur une branche non fusionnée. Le cron ScamSniffer de 01:30 continue de tourner en mode non-chunké (28 lignes, aucune portant de `cycleId`).

C'est exactement le même motif que le §3.3 de `BUILD_WATCHDOG_C4_2026-08-25.md` : **des colonnes prêtes, aucun écrivain**. Deux chantiers indépendants, la même moitié manquante.

## 4.4 Corrections proposées — **non appliquées**

**(a) `prisma/schema.prod.prisma` — CHEMIN GELÉ, `.patch` requis.** Additif pur : 7 champs optionnels + 2 index, aucune modification de champ existant.

```prisma
// PROPOSITION — NON APPLIQUÉE. Bloc à insérer dans model IntelIngestionBatch,
// après `triggeredBy`. Reflète l'état RÉEL de la base (mesuré 2026-08-25).
  cycleId        String?
  chunkIndex     Int?
  sourceVersion  String?
  startOffset    Int?
  cursorNext     Int?
  anchorKey      String?
  processedCount Int?

  @@index([cycleId, chunkIndex])
  @@index([sourceSlug, cycleId])
```

Bloc d'exemption à ajouter à `scripts/guard-offline.sh` pour permettre ce seul fichier :

```bash
# Exemption pour l'alignement de schema.prod.prisma sur la migration chunker
# DÉJÀ APPLIQUÉE en production (7 colonnes + 2 index, mesurées le 2026-08-25 sur
# ep-square-band). Additif pur côté schema : 7 champs optionnels + 2 @@index,
# aucun champ existant modifié, AUCUNE migration à exécuter — la base est déjà
# dans l'état cible, c'est le fichier qui a du retard.
# Exemption STRICTEMENT limitée à prisma/schema.prod.prisma ; ne couvre pas
# prisma/schema.prisma ni le reste de prisma/.
if [[ "$BRANCH" =~ ^feat/cc-offline-[0-9]+-schema-chunker-align$ ]]; then
    EXEMPT_SCHEMA_CHUNKER_PATTERNS=(
        "^prisma/schema\.prod\.prisma$"
    )
fi
```

**(b) L'en-tête de `chunkerStore.prisma.ts` — NON gelé, mais sur une AUTRE branche.**
`src/lib/intelligence/` n'est pas dans `FORBIDDEN_PATTERNS`, donc la correction est triviale — mais le fichier n'existe pas sur `feat/cc-offline-101-watchdog-c4`. **Je ne l'ai pas corrigé** : modifier une branche tierce n'entre pas dans le périmètre de cette session, et le faire depuis ici créerait un commit orphelin. Texte de remplacement proposé, à appliquer sur `feat/cc-offline-98-chunker-scamsniffer` :

```
// ⚠️ INERTE TANT QU'AUCUN CHEMIN DE CODE NE L'APPELLE.
// La migration additive EST passée : les 7 colonnes et les 2 index existent sur
// ep-square-band — mesuré le 2026-08-25 (AUDIT_SCHEMA_INTEGRITY_P1_2026-08-25.md
// §4.1). Ce qui manque n'est plus le schéma, c'est l'écrivain : 28 lignes en
// base, 0 portant un cycleId.
```

**(c) Erratum sur le rapport de migration.** `docs/prep/PACK_MIGRATION_CHUNKER_2026-08-22.md` décrit une migration « à exécuter » qui l'a été. Une ligne d'en-tête suffirait à éviter qu'on la relance. **Non appliqué** — c'est le document d'un autre chantier.

---

## 5. Synthèse — trois criticités, trois traitements

| sous-défaut | verdict | criticité | données en jeu | correction |
|---|---|---|---|---|
| **SI-01** sémantique temporelle | **31 BUG · 7 LEGACY · 37 EXPECTED** | **haute** sur 19 sites vivants, basse sur 12 | 340 k+ lignes intel, 7 353 candidats, 292 liens KOL | branche `-97` couvre 5/31 ; le reste colonne par colonne (1.7) |
| **SI-01-bis** watchdog `pg` (1.4) | **BUG** | **moyenne** | aucune donnée, mais l'alerte affiche un âge faux de 8 h | `TZ=UTC` ou `to_char()` — chemin non gelé |
| **SI-01-ter** `wallet_sync_state` (1.6) | **BUG** | **moyenne** | route admin qui lève à chaque appel | créer la table ou retirer le code |
| **SI-01-quater** `AdminDocument` (1.8) | **BUG** | **moyenne** | 5 appels ORM sur une table absente ; 2 routes admin rendent 500 en permanence | créer la table ou retirer modèle + routes |
| **SI-02** `WatchScan` | **BUG** | **basse** | 0 ligne, 9 lectures live mais inoffensives | aligner le modèle sur la table (`.patch`, décision fondateur) |
| **SI-03** `VaultProfile` | **AUCUN DÉFAUT** | — | — | **aucune** — le sous-défaut se ferme |
| **Bonus** chunker | **dérive documentaire** | **basse** | 28 lignes, 0 chunkée | 3 corrections, dont 1 en chemin gelé (4.4) |

**Rien n'a été appliqué.** Aucune écriture en base, aucune migration, aucun fichier gelé touché, aucune fenêtre de guard ouverte.

---

## 6. UNKNOWN honnêtes

1. **Je n'ai pas rejoué la matrice des 4 fuseaux.** Le mécanisme de SI-01 repose sur le tableau mesuré le 2026-08-21 par le rapport parent (§2.1), que je n'ai pas reproduit — le reproduire exige de poser `SET TimeZone` dans la session, ce qui reste une lecture mais modifie l'état de session. J'ai vérifié le seul fait dont tout dépend : **`current_setting('TimeZone')` = `GMT`**. La preuve du décalage client de 1.4, elle, est de première main.
2. **La classification repose sur le type de la colonne, pas sur une relecture des valeurs stockées.** Je n'ai pas vérifié, ligne à ligne, qu'aucune valeur historique n'a été écrite depuis un poste hors UTC. Le rapport parent (§2.5) argumente que non, par recoupement avec l'horaire des crons ; je n'ai pas ré-instruit ce point.
3. **Les 37 EXPECTED n'ont pas tous été relus statement par statement.** Les `INSERT` positionnels dont le `now()` tombe dans une colonne `timestamptz` ont été vérifiés à la main pour 12 d'entre eux (`EvidenceSnapshot`, `OsintSubmission`, `KolProceedsSummary`, `casefiles`, `alert_deliveries`, `signals`, `influencer_scores`, `onchain_events`) ; les autres reposent sur l'attribution automatique table + type. Le risque résiduel est un `INSERT` dont la colonne à la position du `now()` ne serait pas celle déduite.
4. **`WatchScan` : laquelle des deux définitions fait autorité ?** Hérité d'UNKNOWN-1 du parent, toujours non tranché. Ma proposition (§2.3) suppose que la table fait foi. Si un producteur Watcher V1 attend l'autre forme, c'est le contraire qu'il faut faire.
5. **Le sous-système `surveillance/` est-il abandonné ou en attente ?** 5 tables à 0 ligne et une 6ᵉ inexistante pointent vers « abandonné », mais aucun document ne le dit. 8 des 31 BUG en dépendent.
6. **Périmètre.** SI-01 couvre `src/**` hors tests. Les SQL bruts de `scripts/` (racine, hors `src/scripts/`) et des fichiers `.sql` de `docs/prep/` ne sont **pas** dans le recensement — le rapport parent y avait relevé au moins un site (`scripts/backfill-price-cache.ts:288`, classé EXPECTED).
7. **Je n'ai pas vérifié le sens inverse pour les 178 tables** : combien de tables réelles n'ont **aucun** modèle Prisma. Le §1.8 ne couvre que « modèle sans table ». 178 tables pour 160 modèles laisse au moins 18 tables non modélisées, non recensées ici.
