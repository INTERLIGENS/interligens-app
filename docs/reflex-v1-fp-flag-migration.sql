-- REFLEX V1 — Commit 13 / false-positive flag columns
--
-- Target  : Neon Postgres, ep-square-band ONLY (never ep-bold-sky).
-- How     : paste this entire file into the Neon SQL Editor and run.
-- Safety  : additive ALTER TABLE only. Idempotent via IF NOT EXISTS.
--           No DROP, no data loss, no existing-row migration needed
--           (NOT NULL DEFAULT false fills existing rows automatically).
-- After   : pnpm prisma:generate (already run as part of Commit 13).
--
-- See docs/reflex-v1-migration.md "False-positive flag" section.

BEGIN;

ALTER TABLE "ReflexAnalysis"
  ADD COLUMN IF NOT EXISTS "falsePositiveFlag" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ReflexAnalysis"
  ADD COLUMN IF NOT EXISTS "falsePositiveFlaggedAt" TIMESTAMP(3);

ALTER TABLE "ReflexAnalysis"
  ADD COLUMN IF NOT EXISTS "falsePositiveFlaggedBy" TEXT;

CREATE INDEX IF NOT EXISTS "ReflexAnalysis_falsePositiveFlag_idx"
  ON "ReflexAnalysis"("falsePositiveFlag");

COMMIT;

-- Verify post-apply:
--   \d "ReflexAnalysis"
-- Expected: 3 new columns + 1 new index listed.

-- Rollback (only safe before any row has been flagged):
-- BEGIN;
-- DROP INDEX IF EXISTS "ReflexAnalysis_falsePositiveFlag_idx";
-- ALTER TABLE "ReflexAnalysis" DROP COLUMN IF EXISTS "falsePositiveFlaggedBy";
-- ALTER TABLE "ReflexAnalysis" DROP COLUMN IF EXISTS "falsePositiveFlaggedAt";
-- ALTER TABLE "ReflexAnalysis" DROP COLUMN IF EXISTS "falsePositiveFlag";
-- COMMIT;
