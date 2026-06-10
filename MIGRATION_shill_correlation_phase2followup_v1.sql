-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION_shill_correlation_phase2followup_v1.sql
-- INTERLIGENS — Shill Correlation Engine · PHASE 2 follow-up (Blockers A & C)
--
-- Additive only. Tags each ShillEvent with ticker->mint resolution provenance
-- (Blocker A) and tweet-timestamp provenance (Blocker C). No data is dropped;
-- ticker-only events are kept and tagged. Existing rows take the DEFAULTs, so
-- the migration is safe to run before the backfill writes the real values.
--
-- Run manually in the Neon SQL Editor against the production Default branch
-- (ep-square-band). Never `prisma db push`. Idempotent via IF NOT EXISTS.
--
-- Author: David Pandora / INTERLIGENS
-- Date  : 2026-06-09
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Blocker A — ticker -> mint resolution provenance.
--   resolved_direct | resolved_from_ca_map | resolved_from_tweet
--   | unresolved_ticker | ambiguous_ticker
ALTER TABLE "ShillEvent"
    ADD COLUMN IF NOT EXISTS "resolutionStatus" TEXT NOT NULL DEFAULT 'resolved_direct';

-- Original cashtag/symbol when tokenMint was not already a base58 address
-- (null for resolved_direct). Preserves provenance after tokenMint is upgraded.
ALTER TABLE "ShillEvent"
    ADD COLUMN IF NOT EXISTS "tokenTicker" TEXT;

-- Blocker C — tweetTimestamp provenance.
--   source   : timestamp as ingested from the source row
--   x_api    : recovered from the X API created_at
--   date_only: source was date-only (00:00:00 UTC), not recoverable -> exclude
--              from tweet-time correlation scoring
ALTER TABLE "ShillEvent"
    ADD COLUMN IF NOT EXISTS "timestampSource" TEXT NOT NULL DEFAULT 'source';

-- Triage indexes for the recent-window engine and review.
CREATE INDEX IF NOT EXISTS "ShillEvent_resolutionStatus_idx"
    ON "ShillEvent" ("resolutionStatus");

CREATE INDEX IF NOT EXISTS "ShillEvent_timestampSource_idx"
    ON "ShillEvent" ("timestampSource");

COMMIT;

-- ─── Verification (run after COMMIT) ─────────────────────────────────────────
-- SELECT "resolutionStatus", COUNT(*) FROM "ShillEvent" GROUP BY 1 ORDER BY 2 DESC;
-- SELECT "timestampSource",  COUNT(*) FROM "ShillEvent" GROUP BY 1 ORDER BY 2 DESC;
