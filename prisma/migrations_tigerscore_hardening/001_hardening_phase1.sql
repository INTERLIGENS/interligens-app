-- ─── TigerScore Hardening — Sprint 1 additive migration ─────────────────
-- Two new tables + 3 enums. Fully additive, idempotent.
-- Rollback plan:
--   DROP TABLE IF EXISTS "ScoreSnapshot";
--   DROP TABLE IF EXISTS "EntityGovernedStatus";
--   DROP TYPE IF EXISTS "GovernedStatusReviewStateEnum";
--   DROP TYPE IF EXISTS "GovernedStatusBasisEnum";
--   DROP TYPE IF EXISTS "GovernedStatusEnum";

DO $$ BEGIN CREATE TYPE "GovernedStatusEnum" AS ENUM ('none','watchlisted','suspected','corroborated_high_risk','confirmed_known_bad','authority_flagged'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "GovernedStatusBasisEnum" AS ENUM ('manual_internal_confirmation','external_authority_source','multi_source_corroboration','legacy_case_linkage'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "GovernedStatusReviewStateEnum" AS ENUM ('draft','reviewed','approved'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "EntityGovernedStatus" (
  "id"                TEXT PRIMARY KEY,
  "entityType"        TEXT NOT NULL,
  "entityValue"       TEXT NOT NULL,
  "chain"             TEXT,
  "status"            "GovernedStatusEnum" NOT NULL,
  "basis"             "GovernedStatusBasisEnum",
  "reason"            TEXT,
  "setByUserId"       TEXT NOT NULL,
  "setByUserRole"     TEXT NOT NULL DEFAULT 'admin',
  "setAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewState"       "GovernedStatusReviewStateEnum" NOT NULL DEFAULT 'draft',
  "evidenceRefs"      JSONB NOT NULL DEFAULT '[]'::jsonb,
  "revokedAt"         TIMESTAMP(3),
  "revokedByUserId"   TEXT,
  "revokedReason"     TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "EntityGovernedStatus_entityType_entityValue_key"
  ON "EntityGovernedStatus"("entityType","entityValue");
CREATE INDEX IF NOT EXISTS "EntityGovernedStatus_status_idx" ON "EntityGovernedStatus"("status");
CREATE INDEX IF NOT EXISTS "EntityGovernedStatus_reviewState_idx" ON "EntityGovernedStatus"("reviewState");
CREATE INDEX IF NOT EXISTS "EntityGovernedStatus_setAt_idx" ON "EntityGovernedStatus"("setAt");

CREATE TABLE IF NOT EXISTS "ScoreSnapshot" (
  "id"              TEXT PRIMARY KEY,
  "entityType"      TEXT NOT NULL,
  "entityValue"     TEXT NOT NULL,
  "chain"           TEXT NOT NULL,
  "score"           INTEGER NOT NULL,
  "tier"            TEXT NOT NULL,
  "confidenceLevel" TEXT NOT NULL,
  "version"         TEXT NOT NULL,
  "topReasons"      JSONB NOT NULL,
  "provenanceData"  JSONB,
  "governedStatus"  JSONB,
  "rawInput"        JSONB,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ScoreSnapshot_entity_idx"
  ON "ScoreSnapshot"("entityType","entityValue","createdAt");
CREATE INDEX IF NOT EXISTS "ScoreSnapshot_chain_idx" ON "ScoreSnapshot"("chain");
CREATE INDEX IF NOT EXISTS "ScoreSnapshot_version_idx" ON "ScoreSnapshot"("version");
CREATE INDEX IF NOT EXISTS "ScoreSnapshot_tier_idx" ON "ScoreSnapshot"("tier");
CREATE INDEX IF NOT EXISTS "ScoreSnapshot_createdAt_idx" ON "ScoreSnapshot"("createdAt");
