-- MIGRATION_osint_vision_ingest_v1.sql
-- Sprint: OSINT Vision Ingest V1 (feat/cc-offline-44-osint-vision-ingest)
-- Target DB: Neon ep-square-band ONLY.
--
-- STATUS: NOT APPLIED. Generated for manual execution in the Neon SQL Editor by
-- David. Claude Code never applies migrations and never runs prisma db push.
--
-- ADDITIVE ONLY. Adds two nullable columns to EvidenceSnapshot so vision-auto
-- evidence is distinguishable from manual seeds and carries its confidence blob.
-- No drops, no type changes, no NOT NULL, no backfill required. Safe to re-run
-- (IF NOT EXISTS).
--
--   extractionMethod      : 'vision_auto' for this route; NULL/'manual_seed' for
--                           pre-existing rows. Lets the admin UI filter shadow
--                           vision evidence out of trusted manual evidence.
--   extractionConfidence  : JSONB confidence blob from the vision plan
--                           (per-field confidence + per-token summary).
--
-- The COMMIT route's preflight checks both columns exist before writing.

ALTER TABLE "EvidenceSnapshot"
  ADD COLUMN IF NOT EXISTS "extractionMethod" TEXT;

ALTER TABLE "EvidenceSnapshot"
  ADD COLUMN IF NOT EXISTS "extractionConfidence" JSONB;

-- Optional: index to pull all vision-auto shadow evidence for review.
CREATE INDEX IF NOT EXISTS "EvidenceSnapshot_extractionMethod_idx"
  ON "EvidenceSnapshot" ("extractionMethod");

-- KolTokenLink already has visibility / reviewStatus / sourceType / createdByBridge
-- (Intake Bridge Sprint 1). The commit route reuses them:
--   visibility='draft', reviewStatus='pending_review', sourceType='osint_vision_auto'.
-- No schema change needed there.

-- Verify (run after applying):
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='EvidenceSnapshot'
--      AND column_name IN ('extractionMethod','extractionConfidence');
