-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION_kolprofile_isactive_v1.sql
-- INTERLIGENS — KolProfile lifecycle flag (active / standby)
--
-- Additive only. Adds an isActive flag plus a deactivation audit trail
-- (deactivatedAt, deactivatedReason) to KolProfile so low-value handles can be
-- moved to standby without deletion. Active roster = isActive = true.
--
-- Run manually in the Neon SQL Editor against the production Default branch
-- (ep-square-band). Never `prisma db push`. Idempotent via IF NOT EXISTS.
--
-- Author: David Pandora / INTERLIGENS
-- Date  : 2026-06-12
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Lifecycle flag. true = on the active roster (default), false = standby.
ALTER TABLE "KolProfile"
    ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- When the row was moved to standby. NULL = currently active / never deactivated.
ALTER TABLE "KolProfile"
    ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);

-- Why the row was moved to standby (free-text reason code).
--   e.g. low_followers_under_25k_2026_06_12
ALTER TABLE "KolProfile"
    ADD COLUMN IF NOT EXISTS "deactivatedReason" TEXT;

-- Fast "active roster" lookups (WHERE "isActive" = true).
CREATE INDEX IF NOT EXISTS "KolProfile_isActive_idx"
    ON "KolProfile" ("isActive");

COMMIT;

-- ─── Verification (run after COMMIT) ─────────────────────────────────────────
-- SELECT "isActive", COUNT(*) FROM "KolProfile" GROUP BY 1 ORDER BY 1;
-- SELECT COUNT(*) AS standby FROM "KolProfile" WHERE "isActive" = false;
