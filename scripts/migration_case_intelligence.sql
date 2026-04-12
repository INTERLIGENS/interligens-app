-- ─────────────────────────────────────────────────────────────────────────────
-- Case Intelligence Registry — Layer 1 Migration
-- Generated: 2026-04-12
-- Execute manually in Neon SQL Editor. DO NOT run via prisma db push.
-- These are CREATE IF NOT EXISTS — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "IntelEntityType" AS ENUM ('ADDRESS', 'CONTRACT', 'TOKEN_CA', 'DOMAIN', 'PROJECT', 'PERSON');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "IntelRiskClass" AS ENUM ('SANCTION', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MatchBasis" AS ENUM ('EXACT_ADDRESS', 'EXACT_CONTRACT', 'EXACT_DOMAIN', 'EXACT_TOKEN_CA', 'INFERRED_LINKAGE', 'FUZZY_ALIAS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "IntelDisplaySafety" AS ENUM ('INTERNAL_ONLY', 'ANALYST_REVIEWED', 'RETAIL_SAFE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "IntelCaseType" AS ENUM ('SCAM', 'SANCTION', 'ENFORCEMENT', 'WARNING', 'INVESTIGATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "IntelCaseStatus" AS ENUM ('ACTIVE', 'MONITORING', 'CLOSED', 'DISPUTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── CanonicalEntity ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "intel_canonical_entities" (
  "id"              TEXT PRIMARY KEY,
  "type"            "IntelEntityType" NOT NULL,
  "value"           TEXT NOT NULL,
  "chain"           TEXT,
  "riskClass"       "IntelRiskClass" NOT NULL DEFAULT 'UNKNOWN',
  "strongestSource" TEXT,
  "sourceCount"     INTEGER NOT NULL DEFAULT 1,
  "firstSeenAt"     TIMESTAMPTZ NOT NULL,
  "lastSeenAt"      TIMESTAMPTZ NOT NULL,
  "dedupKey"        TEXT NOT NULL,
  "displaySafety"   "IntelDisplaySafety" NOT NULL DEFAULT 'INTERNAL_ONLY',
  "reviewedBy"      TEXT,
  "reviewedAt"      TIMESTAMPTZ,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "deactivatedAt"   TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "intel_canonical_entities_dedupKey_key"
  ON "intel_canonical_entities" ("dedupKey");
CREATE UNIQUE INDEX IF NOT EXISTS "intel_canonical_entities_type_value_key"
  ON "intel_canonical_entities" ("type", "value");
CREATE INDEX IF NOT EXISTS "intel_canonical_entities_value_idx"
  ON "intel_canonical_entities" ("value");
CREATE INDEX IF NOT EXISTS "intel_canonical_entities_riskClass_isActive_idx"
  ON "intel_canonical_entities" ("riskClass", "isActive");
CREATE INDEX IF NOT EXISTS "intel_canonical_entities_type_isActive_idx"
  ON "intel_canonical_entities" ("type", "isActive");

-- ── SourceObservation ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "intel_source_observations" (
  "id"              TEXT PRIMARY KEY,
  "entityId"        TEXT NOT NULL REFERENCES "intel_canonical_entities"("id"),
  "sourceSlug"      TEXT NOT NULL,
  "sourceTier"      INTEGER NOT NULL,
  "externalId"      TEXT,
  "externalUrl"     TEXT,
  "riskClass"       "IntelRiskClass" NOT NULL,
  "label"           TEXT,
  "matchBasis"      "MatchBasis" NOT NULL,
  "jurisdiction"    TEXT,
  "listType"        TEXT,
  "listIsActive"    BOOLEAN NOT NULL DEFAULT true,
  "removedAt"       TIMESTAMPTZ,
  "lastVerifiedAt"  TIMESTAMPTZ,
  "reportCount"     INTEGER,
  "ingestedAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "observedAt"      TIMESTAMPTZ,
  "meta"            JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS "intel_source_observations_entityId_sourceSlug_key"
  ON "intel_source_observations" ("entityId", "sourceSlug");
CREATE INDEX IF NOT EXISTS "intel_source_observations_entityId_sourceTier_idx"
  ON "intel_source_observations" ("entityId", "sourceTier");
CREATE INDEX IF NOT EXISTS "intel_source_observations_sourceSlug_ingestedAt_idx"
  ON "intel_source_observations" ("sourceSlug", "ingestedAt");
CREATE INDEX IF NOT EXISTS "intel_source_observations_riskClass_listIsActive_idx"
  ON "intel_source_observations" ("riskClass", "listIsActive");

-- ── CaseRecord ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "intel_case_records" (
  "id"              TEXT PRIMARY KEY,
  "title"           TEXT NOT NULL,
  "caseType"        "IntelCaseType" NOT NULL,
  "status"          "IntelCaseStatus" NOT NULL DEFAULT 'ACTIVE',
  "summary"         TEXT,
  "sourceSlug"      TEXT NOT NULL,
  "externalRef"     TEXT,
  "externalUrl"     TEXT,
  "reportedAt"      TIMESTAMPTZ,
  "resolvedAt"      TIMESTAMPTZ,
  "displaySafety"   "IntelDisplaySafety" NOT NULL DEFAULT 'INTERNAL_ONLY',
  "reviewedBy"      TEXT,
  "reviewedAt"      TIMESTAMPTZ,
  "meta"            JSONB,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "intel_case_records_caseType_status_idx"
  ON "intel_case_records" ("caseType", "status");
CREATE INDEX IF NOT EXISTS "intel_case_records_displaySafety_idx"
  ON "intel_case_records" ("displaySafety");

-- ── EntityCase (join table) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "intel_entity_cases" (
  "entityId"   TEXT NOT NULL REFERENCES "intel_canonical_entities"("id"),
  "caseId"     TEXT NOT NULL REFERENCES "intel_case_records"("id"),
  "role"       TEXT,
  "matchBasis" "MatchBasis" NOT NULL,
  PRIMARY KEY ("entityId", "caseId")
);

-- ── IntelIngestionBatch ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "intel_ingestion_batches" (
  "id"              TEXT PRIMARY KEY,
  "sourceSlug"      TEXT NOT NULL,
  "startedAt"       TIMESTAMPTZ NOT NULL,
  "completedAt"     TIMESTAMPTZ,
  "status"          TEXT NOT NULL,
  "recordsFetched"  INTEGER,
  "recordsNew"      INTEGER,
  "recordsUpdated"  INTEGER,
  "recordsRemoved"  INTEGER,
  "errorMessage"    TEXT,
  "triggeredBy"     TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "intel_ingestion_batches_sourceSlug_startedAt_idx"
  ON "intel_ingestion_batches" ("sourceSlug", "startedAt");

-- ── IntelAuditLog ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "intel_audit_log" (
  "id"          TEXT PRIMARY KEY,
  "actor"       TEXT NOT NULL,
  "action"      TEXT NOT NULL,
  "targetType"  TEXT,
  "targetId"    TEXT,
  "detail"      JSONB,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "intel_audit_log_actor_createdAt_idx"
  ON "intel_audit_log" ("actor", "createdAt");
CREATE INDEX IF NOT EXISTS "intel_audit_log_action_createdAt_idx"
  ON "intel_audit_log" ("action", "createdAt");

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: These tables may already exist in prod if previous migrations ran.
-- All CREATE statements use IF NOT EXISTS for idempotency.
-- SQL prêt — à exécuter manuellement dans Neon SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
