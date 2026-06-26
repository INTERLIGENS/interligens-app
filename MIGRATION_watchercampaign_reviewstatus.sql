-- ════════════════════════════════════════════════════════════════════
-- MIGRATION: Evidence Intake Bridge — Sprint 7 (approve/reject review)
-- Add a queryable review status to WatcherCampaign. ADDITIF seul, applied to
-- Neon ep-square-band via raw connection (never prisma db push). Constant
-- default → metadata-only, no table rewrite.
-- Values: 'pending' (default), 'partially_approved', 'approved_public', 'rejected'.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE "WatcherCampaign"
  ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT NOT NULL DEFAULT 'pending';
