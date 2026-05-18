-- ─── MM_TRACKER Phase 9 — FAKE_LIQUIDITY enum value ─────────────────────
-- Single additive change: append FAKE_LIQUIDITY to the existing
-- "MmDetectorType" enum so the 6th core detector can persist its outputs
-- in MmDetectorOutput.detectorType.
--
-- Rollback: enum value removals are not supported by Postgres; if we ever
-- need to revert, we'd have to recreate the enum and migrate dependent
-- columns. For practical purposes this migration is irreversible.
--
-- Uses IF NOT EXISTS (PG 12+) so re-running is a no-op.

ALTER TYPE "MmDetectorType" ADD VALUE IF NOT EXISTS 'FAKE_LIQUIDITY';
