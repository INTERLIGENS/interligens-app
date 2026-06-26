-- ════════════════════════════════════════════════════════════════════
-- MIGRATION: Evidence Intake Bridge — Sprint 5 (candidate state machine)
-- Audit log for SocialPostCandidate status transitions. ADDITIF seul, applied
-- to Neon ep-square-band via raw connection (never prisma db push). No existing
-- column/table modified. The status VALUES themselves need no migration (status
-- is already TEXT on social_post_candidates).
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "CandidateStatusLog" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "candidateId" TEXT NOT NULL,
  "fromStatus"  TEXT NOT NULL,
  "toStatus"    TEXT NOT NULL,
  "reason"      TEXT,
  "actorId"     TEXT,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "CandidateStatusLog_candidateId_idx" ON "CandidateStatusLog" ("candidateId");
CREATE INDEX IF NOT EXISTS "CandidateStatusLog_createdAt_idx"   ON "CandidateStatusLog" ("createdAt");
