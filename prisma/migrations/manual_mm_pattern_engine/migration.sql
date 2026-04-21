-- ============================================================================
-- Migration: MM Pattern Engine — 5 models + 7 enums (additive, idempotent)
-- Target:    Neon ep-square-band (same DATABASE_URL as the app)
-- Safety:    BEGIN/COMMIT, every CREATE uses IF NOT EXISTS or DO $$ guards.
--            Safe to run twice; no-op if Phase 1 created these already.
-- ============================================================================
--
-- Before applying:
--   1. Neon Console → Branches → snapshot label "pre-mm-pattern-engine-<date>".
--   2. Paste the BEGIN..COMMIT block below in the SQL Editor → Run.
--   3. Verify with the SELECTs at the end.
--   4. On the dev machine:
--        cd ~/dev/interligens-web
--        DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-) \
--          npx prisma generate --schema=prisma/schema.prod.prisma
--
-- ============================================================================

BEGIN;

-- ── Enums ─────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "MmRiskBand" AS ENUM ('GREEN', 'YELLOW', 'ORANGE', 'RED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MmChain" AS ENUM
    ('SOLANA', 'ETHEREUM', 'BASE', 'ARBITRUM', 'OPTIMISM', 'BNB', 'POLYGON');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MmSubjectType" AS ENUM ('WALLET', 'TOKEN', 'ENTITY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MmTriggerType" AS ENUM
    ('CRON', 'API_PUBLIC', 'API_ADMIN', 'TIGERSCORE_INTEGRATION', 'BATCH_SCAN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MmDetectorType" AS ENUM
    ('WASH_TRADING', 'CLUSTER_COORDINATION', 'CONCENTRATION_ABNORMALITY',
     'PRICE_ASYMMETRY', 'POST_LISTING_PUMP', 'KNOWN_ENTITY_FLOOR',
     'FAKE_LIQUIDITY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MmSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "MmScanRun" (
  "id"                  TEXT              NOT NULL,
  "subjectType"         "MmSubjectType"   NOT NULL,
  "subjectId"           TEXT              NOT NULL,
  "chain"               "MmChain"         NOT NULL,
  "engineVersion"       TEXT              NOT NULL,
  "detectorsVersion"    JSONB             NOT NULL,
  "schemaVersion"       INTEGER           NOT NULL,
  "cohortKey"           TEXT              NOT NULL,
  "cohortPercentiles"   JSONB             NOT NULL,
  "dataSources"         JSONB             NOT NULL,
  "rawDataRef"          TEXT,
  "registryDrivenScore" INTEGER           NOT NULL,
  "behaviorDrivenScore" INTEGER           NOT NULL,
  "displayScore"        INTEGER           NOT NULL,
  "confidenceLevel"     TEXT              NOT NULL,
  "coverageLevel"       TEXT              NOT NULL,
  "dominantDriver"      TEXT              NOT NULL,
  "displayReason"       TEXT              NOT NULL,
  "signalsCount"        INTEGER           NOT NULL,
  "triggeredBy"         "MmTriggerType"   NOT NULL,
  "triggeredByRef"      TEXT,
  "durationMs"          INTEGER           NOT NULL,
  "errors"              JSONB,
  "createdAt"           TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MmScanRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MmScanRun_subjectId_chain_idx"
  ON "MmScanRun"("subjectId", "chain");
CREATE INDEX IF NOT EXISTS "MmScanRun_createdAt_idx"
  ON "MmScanRun"("createdAt");

CREATE TABLE IF NOT EXISTS "MmDetectorOutput" (
  "id"              TEXT             NOT NULL,
  "scanRunId"       TEXT             NOT NULL,
  "detectorType"    "MmDetectorType" NOT NULL,
  "detectorVersion" TEXT             NOT NULL,
  "score"           INTEGER          NOT NULL,
  "signalsCount"    INTEGER          NOT NULL,
  "signals"         JSONB            NOT NULL,
  "evidence"        JSONB            NOT NULL,
  "durationMs"      INTEGER          NOT NULL,
  CONSTRAINT "MmDetectorOutput_pkey" PRIMARY KEY ("id")
);

-- FK created only if it doesn't already exist.
DO $$ BEGIN
  ALTER TABLE "MmDetectorOutput"
    ADD CONSTRAINT "MmDetectorOutput_scanRunId_fkey"
      FOREIGN KEY ("scanRunId") REFERENCES "MmScanRun"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "MmDetectorOutput_scanRunId_idx"
  ON "MmDetectorOutput"("scanRunId");
CREATE INDEX IF NOT EXISTS "MmDetectorOutput_detectorType_idx"
  ON "MmDetectorOutput"("detectorType");

CREATE TABLE IF NOT EXISTS "MmSignal" (
  "id"           TEXT             NOT NULL,
  "subjectType"  "MmSubjectType"  NOT NULL,
  "subjectId"    TEXT             NOT NULL,
  "chain"        "MmChain"        NOT NULL,
  "detectorType" "MmDetectorType" NOT NULL,
  "severity"     "MmSeverity"     NOT NULL,
  "scoreImpact"  INTEGER          NOT NULL,
  "evidence"     JSONB            NOT NULL,
  "description"  TEXT             NOT NULL,
  "detectedAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"    TIMESTAMP(3),
  "scanRunId"    TEXT,
  "mmEntityId"   TEXT,
  CONSTRAINT "MmSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MmSignal_subjectId_chain_idx"
  ON "MmSignal"("subjectId", "chain");
CREATE INDEX IF NOT EXISTS "MmSignal_detectorType_idx"
  ON "MmSignal"("detectorType");
CREATE INDEX IF NOT EXISTS "MmSignal_detectedAt_idx"
  ON "MmSignal"("detectedAt");

CREATE TABLE IF NOT EXISTS "MmScore" (
  "id"                  TEXT             NOT NULL,
  "subjectType"         "MmSubjectType"  NOT NULL,
  "subjectId"           TEXT             NOT NULL,
  "chain"               "MmChain"        NOT NULL,
  "registryDrivenScore" INTEGER          NOT NULL,
  "behaviorDrivenScore" INTEGER          NOT NULL,
  "displayScore"        INTEGER          NOT NULL,
  "band"                "MmRiskBand"     NOT NULL,
  "confidence"          TEXT             NOT NULL,
  "coverage"            TEXT             NOT NULL,
  "dominantDriver"      TEXT             NOT NULL,
  "displayReason"       TEXT             NOT NULL,
  "breakdown"           JSONB            NOT NULL,
  "signalsCount"        INTEGER          NOT NULL,
  "scanRunId"           TEXT             NOT NULL,
  "computedAt"          TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"           TIMESTAMP(3)     NOT NULL,
  "schemaVersion"       INTEGER          NOT NULL DEFAULT 1,
  CONSTRAINT "MmScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MmScore_subjectType_subjectId_chain_key"
  ON "MmScore"("subjectType", "subjectId", "chain");
CREATE INDEX IF NOT EXISTS "MmScore_computedAt_idx"
  ON "MmScore"("computedAt");

CREATE TABLE IF NOT EXISTS "MmCohortPercentile" (
  "id"                   TEXT         NOT NULL,
  "cohortKey"            TEXT         NOT NULL,
  "metricName"           TEXT         NOT NULL,
  "p50"                  DOUBLE PRECISION NOT NULL,
  "p75"                  DOUBLE PRECISION NOT NULL,
  "p90"                  DOUBLE PRECISION NOT NULL,
  "p95"                  DOUBLE PRECISION NOT NULL,
  "p99"                  DOUBLE PRECISION NOT NULL,
  "sampleSize"           INTEGER      NOT NULL,
  "excludedFlaggedCount" INTEGER      NOT NULL,
  "computedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "schemaVersion"        INTEGER      NOT NULL DEFAULT 1,
  "notes"                TEXT,
  CONSTRAINT "MmCohortPercentile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MmCohortPercentile_cohortKey_metricName_schemaVersion_key"
  ON "MmCohortPercentile"("cohortKey", "metricName", "schemaVersion");
CREATE INDEX IF NOT EXISTS "MmCohortPercentile_cohortKey_idx"
  ON "MmCohortPercentile"("cohortKey");
CREATE INDEX IF NOT EXISTS "MmCohortPercentile_computedAt_idx"
  ON "MmCohortPercentile"("computedAt");

COMMIT;

-- ── Verify ────────────────────────────────────────────────────────────────

SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name LIKE 'Mm%'
 ORDER BY table_name;

SELECT typname
  FROM pg_type
 WHERE typname LIKE 'Mm%'
 ORDER BY typname;
