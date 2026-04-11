# Retail Vision — Migration & Decisions Log

Branch: `feat/retail-vision`
Schema target: `prisma/schema.prod.prisma` (Postgres, Neon `ep-square-band`, Frankfurt, 6543 pgbouncer)
Migration policy: **SQL only, no `prisma db push`, no automatic execution in prod.**

---

## 1. 8-point execution plan

1. **Audit** existing schema + code that references `KolProceedsSummary` / `KolProceedsEvent` (confirmed: used via raw SQL; not declared in Prisma schema).
2. **Phase 1 — Schema**: add 4 new Prisma models (`WalletFundingEdge`, `KolPromotionMention`, `TokenLaunchMetric`, `KolTokenInvolvement`) to `prisma/schema.prod.prisma`, plus required back-relations on `KolProfile` and `KolWallet`. Generate raw SQL for all CREATE TABLE + indexes.
3. **Phase 1b — Rolling fields on KolProceedsSummary**: ALTER TABLE only (the model is not in Prisma schema); document SQL for `rolling24h/7d/30d/365dUsd`, `avgDumpDelayMinutes`, `lastFlowComputedAt`.
4. **Phase 2 — Funded-by**: `src/lib/helius/fundedBy.ts` (fail-soft Helius caller + upsert to `WalletFundingEdge`) and `src/scripts/seed/fundedBy.ts` (iterate existing SOLANA wallets, does NOT auto-run).
5. **Phase 3 — Daily flow cron**: `src/app/api/cron/daily-flow/route.ts` protected by `CRON_SECRET`, iterates active `KolWallet`, fetches 24h TXs per chain, identifies exchange outflows using `src/lib/chains/exchanges.ts`, prices via existing `PriceCache`/`getPriceAtDate`, upserts `KolProceedsSummary` rolling columns. Add entry in `vercel.json`.
6. **Phase 4 — Public alert endpoint**: `src/app/api/token/[chain]/[address]/kol-alert/route.ts`, public, rate-limited (Upstash if available else IP header bucket), returns retail-safe JSON derived from `KolTokenInvolvement`.
7. **Phase 5 — Retail UI**: `src/lib/retail/labels.ts` dictionary + `src/components/kol/RetailCounter.tsx` + `src/components/token/KolAlert.tsx`, wired into `/en/kol/[handle]` and scan surfaces.
8. **Vitest + finalize**: run `pnpm test`, keep 75 baseline green, update this doc with results, commit on `feat/retail-vision`. No prod deploy, no DB execution.

---

## 2. Decisions log (autonomous)

| # | Question | Decision | Why |
|---|----------|----------|-----|
| D1 | `Chain` enum is referenced in the brief but **does not exist** in `schema.prod.prisma` (existing `KolWallet.chain` is `String` defaulted to `"SOL"`). | Use `String` columns everywhere (`chain String`), with convention `"SOL" \| "ETH" \| "BSC" \| "TRON"`. No enum. | Matches existing `KolWallet.chain`. Adding a new enum would force a backfill and ripple across existing tables — not additive. |
| D2 | Brief uses `kol Kol @relation(...)` but there is no `Kol` model. Only `KolProfile` (unique `handle`) exists. | Relations point at `KolProfile` via `kolHandle`. | The brief's own note says "kolProfile (pas kOLProfile)"; `Kol` is a typo. `KolProfile.handle` is the existing unique key. |
| D3 | `KolProceedsSummary` is referenced as an existing Prisma model to **update** with rolling fields. In this repo it is **not declared in Prisma** — it's used only via raw SQL in `src/lib/kol/proceeds.ts`. | Do **not** add it to `schema.prod.prisma`. Add rolling columns via raw `ALTER TABLE` SQL in this doc only. Daily-flow cron writes rolling columns via `$executeRawUnsafe`, mirroring the existing pattern. | Keeps the change strictly additive. Pulling the table into Prisma now would require reconciling unknown columns and risk drift with prod. |
| D4 | Helius funded-by is uncertain for non-Solana wallets. | Phase 2 is Solana-only, fail-soft (`try/catch` around everything). Other chains are out of scope for funded-by in this pass. | Matches the brief's Phase 2 wording ("KolWallet chain=SOLANA existants"). |
| D5 | Rate limiting for public alert endpoint. | Feature-detect `@upstash/ratelimit` / `@upstash/redis` at runtime; if unavailable, fall back to an in-process IP bucket (`Map<ip, { count, windowStart }>`) keyed by `x-forwarded-for`. 10 req / min / IP. | Non-blocking: gets us retail protection even without Upstash env vars. |
| D6 | Exchange hot-wallet list (Binance/OKX/Coinbase/Kraken/Bybit) for `src/lib/chains/exchanges.ts`. | Hardcoded seed list with well-known publicly-documented hot wallets per chain. Marked with `// source:` comments. Consumers match case-insensitively. | Matches brief; list is data, not secrets. |
| D7 | `avgDumpDelayMinutes` on `KolProceedsSummary`: the brief asks for it, but the field also appears in `KolTokenInvolvement`. | Both locations get it. `KolProceedsSummary.avgDumpDelayMinutes` = mean across all published token involvements for that KOL; `KolTokenInvolvement.avgDumpDelayMinutes` = per-token value. | Lets the daily-flow cron write the rollup even before per-token data lands. |
| D8 | Seed script auto-execution. | Script prints decisions and logs each upsert, but the file's default behavior is to require `SEED_FUNDEDBY=1` env var to actually run, otherwise dry-runs. | Brief says "ne pas exécuter automatiquement". |

---

## 3. Prisma schema additions (Phase 1)

Added to `prisma/schema.prod.prisma` below the existing `AskLog`/`ask_logs` block.

Fields are **strictly additive**. `KolWallet` and `KolProfile` gain only back-relation arrays (no field deletions, no column renames). `KolProceedsEvent` is untouched.

See `prisma/schema.prod.prisma` for the canonical definitions.

---

## 4. Raw SQL migration (to be run manually via Neon SQL Editor)

> **Do not run automatically.** Paste into Neon SQL Editor on `ep-square-band` only, after a backup, and with human gate.

```sql
-- =========================================================================
-- Retail Vision migration (additive only)
-- Target: Neon ep-square-band
-- Branch: feat/retail-vision
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. TokenLaunchMetric
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TokenLaunchMetric" (
  "id"                 TEXT PRIMARY KEY,
  "chain"              TEXT NOT NULL,
  "tokenMint"          TEXT NOT NULL,
  "launchAt"           TIMESTAMP(3),
  "totalSupply"        NUMERIC(38,0),
  "top3Pct"            NUMERIC(7,4),
  "top10Pct"           NUMERIC(7,4),
  "holderCount"        INTEGER,
  "concentrationScore" INTEGER,
  "source"             TEXT NOT NULL,
  "computedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "raw"                JSONB,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "TokenLaunchMetric_chain_tokenMint_key"
  ON "TokenLaunchMetric"("chain","tokenMint");
CREATE INDEX IF NOT EXISTS "TokenLaunchMetric_chain_concentrationScore_idx"
  ON "TokenLaunchMetric"("chain","concentrationScore");

-- -------------------------------------------------------------------------
-- 2. WalletFundingEdge
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "WalletFundingEdge" (
  "id"               TEXT PRIMARY KEY,
  "chain"            TEXT NOT NULL,
  "fromWalletId"     TEXT,
  "toWalletId"       TEXT NOT NULL,
  "fromAddress"      TEXT NOT NULL,
  "toAddress"        TEXT NOT NULL,
  "source"           TEXT NOT NULL,
  "observedAt"       TIMESTAMP(3) NOT NULL,
  "confidence"       INTEGER NOT NULL DEFAULT 60,
  "projectTokenMint" TEXT,
  "isProjectLinked"  BOOLEAN NOT NULL DEFAULT false,
  "raw"              JSONB,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletFundingEdge_fromWalletId_fkey"
    FOREIGN KEY ("fromWalletId") REFERENCES "KolWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "WalletFundingEdge_toWalletId_fkey"
    FOREIGN KEY ("toWalletId") REFERENCES "KolWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "WalletFundingEdge_toWalletId_observedAt_idx"
  ON "WalletFundingEdge"("toWalletId","observedAt");
CREATE INDEX IF NOT EXISTS "WalletFundingEdge_chain_toAddress_idx"
  ON "WalletFundingEdge"("chain","toAddress");
CREATE INDEX IF NOT EXISTS "WalletFundingEdge_projectTokenMint_chain_idx"
  ON "WalletFundingEdge"("projectTokenMint","chain");

-- -------------------------------------------------------------------------
-- 3. KolPromotionMention
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "KolPromotionMention" (
  "id"             TEXT PRIMARY KEY,
  "kolHandle"      TEXT NOT NULL,
  "walletId"       TEXT,
  "chain"          TEXT NOT NULL,
  "tokenMint"      TEXT NOT NULL,
  "tokenSymbol"    TEXT,
  "sourcePlatform" TEXT NOT NULL,
  "sourcePostId"   TEXT NOT NULL,
  "sourceUrl"      TEXT,
  "postedAt"       TIMESTAMP(3) NOT NULL,
  "contentSnippet" TEXT,
  "watcherRunId"   TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KolPromotionMention_kolHandle_fkey"
    FOREIGN KEY ("kolHandle") REFERENCES "KolProfile"("handle") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "KolPromotionMention_walletId_fkey"
    FOREIGN KEY ("walletId") REFERENCES "KolWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "KolPromotionMention_sourcePlatform_sourcePostId_key"
  ON "KolPromotionMention"("sourcePlatform","sourcePostId");
CREATE INDEX IF NOT EXISTS "KolPromotionMention_kolHandle_postedAt_idx"
  ON "KolPromotionMention"("kolHandle","postedAt");
CREATE INDEX IF NOT EXISTS "KolPromotionMention_chain_tokenMint_postedAt_idx"
  ON "KolPromotionMention"("chain","tokenMint","postedAt");

-- -------------------------------------------------------------------------
-- 4. KolTokenInvolvement
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "KolTokenInvolvement" (
  "id"                    TEXT PRIMARY KEY,
  "kolHandle"             TEXT NOT NULL,
  "walletId"              TEXT,
  "chain"                 TEXT NOT NULL,
  "tokenMint"             TEXT NOT NULL,
  "firstPromotionAt"      TIMESTAMP(3),
  "firstBuyAt"            TIMESTAMP(3),
  "firstSellAt"           TIMESTAMP(3),
  "avgDumpDelayMinutes"   INTEGER,
  "soldPct"               NUMERIC(7,4),
  "proceedsUsd"           NUMERIC(20,2),
  "retailLossEstimateUsd" NUMERIC(20,2),
  "isPromoted"            BOOLEAN NOT NULL DEFAULT false,
  "isFundedByProject"     BOOLEAN NOT NULL DEFAULT false,
  "projectFundingEdgeId"  TEXT,
  "launchMetricId"        TEXT,
  "lastComputedAt"        TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KolTokenInvolvement_kolHandle_fkey"
    FOREIGN KEY ("kolHandle") REFERENCES "KolProfile"("handle") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "KolTokenInvolvement_walletId_fkey"
    FOREIGN KEY ("walletId") REFERENCES "KolWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "KolTokenInvolvement_projectFundingEdgeId_fkey"
    FOREIGN KEY ("projectFundingEdgeId") REFERENCES "WalletFundingEdge"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "KolTokenInvolvement_launchMetricId_fkey"
    FOREIGN KEY ("launchMetricId") REFERENCES "TokenLaunchMetric"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "KolTokenInvolvement_kolHandle_chain_tokenMint_key"
  ON "KolTokenInvolvement"("kolHandle","chain","tokenMint");
CREATE INDEX IF NOT EXISTS "KolTokenInvolvement_chain_tokenMint_idx"
  ON "KolTokenInvolvement"("chain","tokenMint");
CREATE INDEX IF NOT EXISTS "KolTokenInvolvement_kolHandle_lastComputedAt_idx"
  ON "KolTokenInvolvement"("kolHandle","lastComputedAt");

-- -------------------------------------------------------------------------
-- 5. KolProceedsSummary — rolling columns (additive)
--    The table already exists in prod but is not declared in Prisma.
-- -------------------------------------------------------------------------
ALTER TABLE "KolProceedsSummary"
  ADD COLUMN IF NOT EXISTS "rolling24hUsd"       NUMERIC(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "rolling7dUsd"        NUMERIC(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "rolling30dUsd"       NUMERIC(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "rolling365dUsd"      NUMERIC(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "avgDumpDelayMinutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "lastFlowComputedAt"  TIMESTAMP(3);

COMMIT;
```

---

## 5. FundedBy Results

_(populated by `src/scripts/seed/fundedBy.ts` when run with `SEED_FUNDEDBY=1`)_

| Run timestamp | Wallets scanned | Funding edges created | Project-linked | Errors |
|---------------|-----------------|------------------------|----------------|--------|

No runs yet.

---

## 6. Files created / modified

### Created
- `MIGRATION_RETAILVISION.md` — this file
- `src/lib/helius/fundedBy.ts`
- `src/scripts/seed/fundedBy.ts`
- `src/lib/chains/exchanges.ts`
- `src/app/api/cron/daily-flow/route.ts`
- `src/app/api/token/[chain]/[address]/kol-alert/route.ts`
- `src/lib/retail/labels.ts`
- `src/components/kol/RetailCounter.tsx`
- `src/components/token/KolAlert.tsx`

### Modified
- `prisma/schema.prod.prisma` — 4 new models + back-relations on `KolProfile` and `KolWallet`
- `vercel.json` — add `/api/cron/daily-flow` entry
- `src/app/en/kol/[handle]/page.tsx` — mount `<RetailCounter>`

---

## 7. Vitest baseline

Brief target: "75 tests verts". Actual repo baseline on `main`: **519 tests** across 65 files.

Run on `feat/retail-vision` after Retail Vision changes:

- **513 passed / 6 failed** (same 6 that fail on `main` — verified by stash test).
- Pre-existing failures, **not** caused by this branch:
  - `src/lib/copy/verdictCopy.test.ts` — 4 copy-drift assertions
  - `src/app/api/admin/__tests__/adminRoutes.integration.test.ts` — 2 integration tests needing live Neon credentials
- `tsc --noEmit` — clean.
- `prisma validate --schema=prisma/schema.prod.prisma` — clean.

**Conclusion: no regression introduced.**

---

## 8. Deployment gate

This branch is NOT auto-deployed. Prod deploy requires:
1. Human review of this document
2. Manual run of the SQL block via Neon SQL Editor on `ep-square-band`
3. `npx vercel --prod` gated by the operator
