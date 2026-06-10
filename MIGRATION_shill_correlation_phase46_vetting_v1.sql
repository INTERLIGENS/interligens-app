-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION_shill_correlation_phase46_vetting_v1.sql
-- INTERLIGENS — Shill Correlation Engine · PHASE 4.6 (autonomous bot/router vetting)
--
-- Additive only. Adds exclusion + wallet-profile columns to
-- ShillCorrelationCandidate so router/bot/HFT exclusions are persisted with
-- reason codes and an audit trail. Surviving candidates = excludedReason IS NULL.
--
-- Run manually in the Neon SQL Editor against the production Default branch
-- (ep-square-band). Never `prisma db push`. Idempotent via IF NOT EXISTS.
--
-- Author: David Pandora / INTERLIGENS
-- Date  : 2026-06-10
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Exclusion reason. NULL = surviving candidate (passed all filters).
--   known_router | high_frequency | too_many_tokens | bot_infra
ALTER TABLE "ShillCorrelationCandidate"
    ADD COLUMN IF NOT EXISTS "excludedReason" TEXT;

-- Wallet activity profile captured at vetting time (Helius). NULL = not vetted.
ALTER TABLE "ShillCorrelationCandidate"
    ADD COLUMN IF NOT EXISTS "walletTxCount30d" INTEGER;

ALTER TABLE "ShillCorrelationCandidate"
    ADD COLUMN IF NOT EXISTS "walletTokenAccounts" INTEGER;

ALTER TABLE "ShillCorrelationCandidate"
    ADD COLUMN IF NOT EXISTS "walletVettedAt" TIMESTAMP(3);

-- Fast "surviving candidates" lookups (excludedReason IS NULL, top score).
CREATE INDEX IF NOT EXISTS "ShillCorrelationCandidate_excludedReason_correlationScore_idx"
    ON "ShillCorrelationCandidate" ("excludedReason", "correlationScore" DESC);

COMMIT;

-- ─── Verification (run after COMMIT) ─────────────────────────────────────────
-- SELECT "excludedReason", COUNT(*) FROM "ShillCorrelationCandidate" GROUP BY 1 ORDER BY 2 DESC;
-- SELECT COUNT(*) AS surviving FROM "ShillCorrelationCandidate" WHERE "excludedReason" IS NULL;
