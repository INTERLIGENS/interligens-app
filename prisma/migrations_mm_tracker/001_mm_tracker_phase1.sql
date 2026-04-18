-- MM_TRACKER Phase 1 — additive migration
-- 11 new tables + enums. Rollback = DROP TABLE for all Mm* tables + DROP TYPE for all Mm* types.
-- Idempotent via IF NOT EXISTS.

-- ─── ENUMS ─────────────────────────────────────────────────────────────────

DO $$ BEGIN CREATE TYPE "MmStatus" AS ENUM ('CONVICTED','CHARGED','SETTLED','INVESTIGATED','DOCUMENTED','OBSERVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MmRiskBand" AS ENUM ('GREEN','YELLOW','ORANGE','RED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MmWorkflow" AS ENUM ('DRAFT','REVIEWED','PUBLISHED','CHALLENGED','UNPUBLISHED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MmSourceType" AS ENUM ('DOJ','CFTC','SEC','COURT','REGULATOR','MEDIA_TIER1','MEDIA_TIER2','MEDIA_TIER3','OSINT','OFFICIAL','HACK_LEAK'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MmCredTier" AS ENUM ('TIER_1','TIER_2','TIER_3'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MmArchivalStatus" AS ENUM ('PENDING','SUCCESS','WAYBACK_FAIL','R2_FAIL','RETRY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MmClaimType" AS ENUM ('FACT','ALLEGATION','INFERENCE','RESPONSE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MmPubStatus" AS ENUM ('DRAFT','REVIEWED','PUBLISHED','RETRACTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MmChain" AS ENUM ('SOLANA','ETHEREUM','BASE','ARBITRUM','OPTIMISM','BNB','POLYGON'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MmAttribMethod" AS ENUM ('ARKHAM','HACK_LEAK','OFFICIAL','OSINT','INFERRED_CLUSTER','COURT_FILING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MmTargetType" AS ENUM ('ENTITY','CLAIM','ATTRIBUTION','SOURCE','CHALLENGE','SCAN_RUN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MmReviewAction" AS ENUM ('CREATED','EDITED','REVIEWED','PUBLISHED','UNPUBLISHED','CHALLENGED','CHALLENGE_VERIFIED','CHALLENGE_REJECTED','CORRECTED','RETRACTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MmSubjectType" AS ENUM ('WALLET','TOKEN','ENTITY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MmTriggerType" AS ENUM ('CRON','API_PUBLIC','API_ADMIN','TIGERSCORE_INTEGRATION','BATCH_SCAN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MmDetectorType" AS ENUM ('WASH_TRADING','CLUSTER_COORDINATION','CONCENTRATION_ABNORMALITY','PRICE_ASYMMETRY','POST_LISTING_PUMP','KNOWN_ENTITY_FLOOR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MmSeverity" AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MmVerifStatus" AS ENUM ('PENDING','EMAIL_VERIFIED','LEGAL_VERIFIED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MmVerifMethod" AS ENUM ('EMAIL_DKIM','LEGAL_SIGNATURE','OFFICIAL_CHANNEL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── TABLES ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "MmEntity" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "jurisdiction" TEXT,
  "foundedYear" INTEGER,
  "founders" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "MmStatus" NOT NULL,
  "riskBand" "MmRiskBand" NOT NULL,
  "defaultScore" INTEGER NOT NULL,
  "publicSummary" TEXT NOT NULL,
  "publicSummaryFr" TEXT,
  "knownAliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "officialDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "workflow" "MmWorkflow" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "MmEntity_slug_idx" ON "MmEntity"("slug");
CREATE INDEX IF NOT EXISTS "MmEntity_status_idx" ON "MmEntity"("status");
CREATE INDEX IF NOT EXISTS "MmEntity_workflow_idx" ON "MmEntity"("workflow");

CREATE TABLE IF NOT EXISTS "MmSource" (
  "id" TEXT PRIMARY KEY,
  "publisher" TEXT NOT NULL,
  "sourceType" "MmSourceType" NOT NULL,
  "url" TEXT NOT NULL,
  "archivedUrl" TEXT,
  "archivalStatus" "MmArchivalStatus" NOT NULL DEFAULT 'PENDING',
  "archivalError" TEXT,
  "localSnapshot" TEXT,
  "title" TEXT NOT NULL,
  "author" TEXT,
  "publishedAt" TIMESTAMP(3),
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "credibilityTier" "MmCredTier" NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'en',
  "notes" TEXT
);
CREATE INDEX IF NOT EXISTS "MmSource_sourceType_idx" ON "MmSource"("sourceType");
CREATE INDEX IF NOT EXISTS "MmSource_credibilityTier_idx" ON "MmSource"("credibilityTier");
CREATE INDEX IF NOT EXISTS "MmSource_archivalStatus_idx" ON "MmSource"("archivalStatus");

CREATE TABLE IF NOT EXISTS "MmClaim" (
  "id" TEXT PRIMARY KEY,
  "mmEntityId" TEXT NOT NULL,
  "claimType" "MmClaimType" NOT NULL,
  "text" TEXT NOT NULL,
  "textFr" TEXT,
  "sourceId" TEXT NOT NULL,
  "jurisdiction" TEXT,
  "publishStatus" "MmPubStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MmClaim_mmEntityId_fkey" FOREIGN KEY ("mmEntityId") REFERENCES "MmEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MmClaim_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MmSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MmClaim_mmEntityId_idx" ON "MmClaim"("mmEntityId");
CREATE INDEX IF NOT EXISTS "MmClaim_claimType_idx" ON "MmClaim"("claimType");
CREATE INDEX IF NOT EXISTS "MmClaim_publishStatus_idx" ON "MmClaim"("publishStatus");

CREATE TABLE IF NOT EXISTS "MmAttribution" (
  "id" TEXT PRIMARY KEY,
  "walletAddress" TEXT NOT NULL,
  "chain" "MmChain" NOT NULL,
  "mmEntityId" TEXT NOT NULL,
  "attributionMethod" "MmAttribMethod" NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "evidenceRefs" JSONB NOT NULL,
  "reviewerUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "challengedAt" TIMESTAMP(3),
  "challengeReason" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MmAttribution_mmEntityId_fkey" FOREIGN KEY ("mmEntityId") REFERENCES "MmEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MmAttribution_walletAddress_chain_idx" ON "MmAttribution"("walletAddress","chain");
CREATE INDEX IF NOT EXISTS "MmAttribution_mmEntityId_idx" ON "MmAttribution"("mmEntityId");
CREATE INDEX IF NOT EXISTS "MmAttribution_confidence_idx" ON "MmAttribution"("confidence");

CREATE TABLE IF NOT EXISTS "MmReviewLog" (
  "id" TEXT PRIMARY KEY,
  "targetType" "MmTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "action" "MmReviewAction" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "notes" TEXT,
  "snapshotBefore" JSONB,
  "snapshotAfter" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "MmReviewLog_targetType_targetId_idx" ON "MmReviewLog"("targetType","targetId");
CREATE INDEX IF NOT EXISTS "MmReviewLog_actorUserId_idx" ON "MmReviewLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "MmReviewLog_createdAt_idx" ON "MmReviewLog"("createdAt");
CREATE INDEX IF NOT EXISTS "MmReviewLog_action_idx" ON "MmReviewLog"("action");

CREATE TABLE IF NOT EXISTS "MmScanRun" (
  "id" TEXT PRIMARY KEY,
  "subjectType" "MmSubjectType" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "chain" "MmChain" NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "detectorsVersion" JSONB NOT NULL,
  "schemaVersion" INTEGER NOT NULL,
  "cohortKey" TEXT NOT NULL,
  "cohortPercentiles" JSONB NOT NULL,
  "dataSources" JSONB NOT NULL,
  "rawDataRef" TEXT,
  "registryDrivenScore" INTEGER NOT NULL,
  "behaviorDrivenScore" INTEGER NOT NULL,
  "displayScore" INTEGER NOT NULL,
  "confidenceLevel" TEXT NOT NULL,
  "coverageLevel" TEXT NOT NULL,
  "dominantDriver" TEXT NOT NULL,
  "displayReason" TEXT NOT NULL,
  "signalsCount" INTEGER NOT NULL,
  "triggeredBy" "MmTriggerType" NOT NULL,
  "triggeredByRef" TEXT,
  "durationMs" INTEGER NOT NULL,
  "errors" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "MmScanRun_subjectId_chain_idx" ON "MmScanRun"("subjectId","chain");
CREATE INDEX IF NOT EXISTS "MmScanRun_createdAt_idx" ON "MmScanRun"("createdAt");

CREATE TABLE IF NOT EXISTS "MmDetectorOutput" (
  "id" TEXT PRIMARY KEY,
  "scanRunId" TEXT NOT NULL,
  "detectorType" "MmDetectorType" NOT NULL,
  "detectorVersion" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "signalsCount" INTEGER NOT NULL,
  "signals" JSONB NOT NULL,
  "evidence" JSONB NOT NULL,
  "durationMs" INTEGER NOT NULL,
  CONSTRAINT "MmDetectorOutput_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "MmScanRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MmDetectorOutput_scanRunId_idx" ON "MmDetectorOutput"("scanRunId");
CREATE INDEX IF NOT EXISTS "MmDetectorOutput_detectorType_idx" ON "MmDetectorOutput"("detectorType");

CREATE TABLE IF NOT EXISTS "MmCohortPercentile" (
  "id" TEXT PRIMARY KEY,
  "cohortKey" TEXT NOT NULL,
  "metricName" TEXT NOT NULL,
  "p50" DOUBLE PRECISION NOT NULL,
  "p75" DOUBLE PRECISION NOT NULL,
  "p90" DOUBLE PRECISION NOT NULL,
  "p95" DOUBLE PRECISION NOT NULL,
  "p99" DOUBLE PRECISION NOT NULL,
  "sampleSize" INTEGER NOT NULL,
  "excludedFlaggedCount" INTEGER NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "MmCohortPercentile_cohortKey_metricName_schemaVersion_key"
  ON "MmCohortPercentile"("cohortKey","metricName","schemaVersion");
CREATE INDEX IF NOT EXISTS "MmCohortPercentile_cohortKey_idx" ON "MmCohortPercentile"("cohortKey");
CREATE INDEX IF NOT EXISTS "MmCohortPercentile_computedAt_idx" ON "MmCohortPercentile"("computedAt");

CREATE TABLE IF NOT EXISTS "MmSignal" (
  "id" TEXT PRIMARY KEY,
  "subjectType" "MmSubjectType" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "chain" "MmChain" NOT NULL,
  "detectorType" "MmDetectorType" NOT NULL,
  "severity" "MmSeverity" NOT NULL,
  "scoreImpact" INTEGER NOT NULL,
  "evidence" JSONB NOT NULL,
  "description" TEXT NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "scanRunId" TEXT,
  "mmEntityId" TEXT,
  CONSTRAINT "MmSignal_mmEntityId_fkey" FOREIGN KEY ("mmEntityId") REFERENCES "MmEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MmSignal_subjectId_chain_idx" ON "MmSignal"("subjectId","chain");
CREATE INDEX IF NOT EXISTS "MmSignal_detectorType_idx" ON "MmSignal"("detectorType");
CREATE INDEX IF NOT EXISTS "MmSignal_detectedAt_idx" ON "MmSignal"("detectedAt");

CREATE TABLE IF NOT EXISTS "MmChallenge" (
  "id" TEXT PRIMARY KEY,
  "targetType" "MmTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "challengerEmail" TEXT NOT NULL,
  "challengerName" TEXT NOT NULL,
  "challengerRole" TEXT,
  "challengerEntity" TEXT NOT NULL,
  "claimedText" TEXT NOT NULL,
  "responseText" TEXT NOT NULL,
  "verificationStatus" "MmVerifStatus" NOT NULL DEFAULT 'PENDING',
  "verificationMethod" "MmVerifMethod",
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "publishStatus" "MmPubStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "MmChallenge_targetType_targetId_idx" ON "MmChallenge"("targetType","targetId");
CREATE INDEX IF NOT EXISTS "MmChallenge_verificationStatus_idx" ON "MmChallenge"("verificationStatus");
CREATE INDEX IF NOT EXISTS "MmChallenge_publishStatus_idx" ON "MmChallenge"("publishStatus");

CREATE TABLE IF NOT EXISTS "MmScore" (
  "id" TEXT PRIMARY KEY,
  "subjectType" "MmSubjectType" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "chain" "MmChain" NOT NULL,
  "registryDrivenScore" INTEGER NOT NULL,
  "behaviorDrivenScore" INTEGER NOT NULL,
  "displayScore" INTEGER NOT NULL,
  "band" "MmRiskBand" NOT NULL,
  "confidence" TEXT NOT NULL,
  "coverage" TEXT NOT NULL,
  "dominantDriver" TEXT NOT NULL,
  "displayReason" TEXT NOT NULL,
  "breakdown" JSONB NOT NULL,
  "signalsCount" INTEGER NOT NULL,
  "scanRunId" TEXT NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS "MmScore_subjectType_subjectId_chain_key"
  ON "MmScore"("subjectType","subjectId","chain");
CREATE INDEX IF NOT EXISTS "MmScore_computedAt_idx" ON "MmScore"("computedAt");
