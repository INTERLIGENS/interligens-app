-- REFLEX V1 — Prisma schema migration (Commit 4/15)
--
-- Target  : Neon Postgres, ep-square-band branch ONLY
--           (never ep-bold-sky, never local dev.db)
-- How     : paste the entire file into the Neon SQL Editor and run
--           inside the wrapping transaction below.
-- Safety  : strictly additive — 3 CREATE TABLE, 12 CREATE INDEX.
--           No DROP, no ALTER on existing tables. Idempotent guards
--           via IF NOT EXISTS make re-runs safe.
-- After   : `npx prisma generate` locally (already run as part of
--           Commit 4). Verify `\dt` lists the three new tables.
--
-- Generated via:
--   npx prisma migrate diff \
--     --from-schema-datamodel /tmp/reflex-schema-pre.prisma \
--     --to-schema-datamodel prisma/schema.prod.prisma \
--     --script
--
-- See docs/reflex-v1-migration.md for the full procedure.

BEGIN;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReflexAnalysis" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inputRaw" TEXT NOT NULL,
    "inputType" TEXT NOT NULL,
    "inputChain" TEXT,
    "inputResolvedAddress" TEXT,
    "inputResolvedHandle" TEXT,
    "verdict" TEXT NOT NULL,
    "verdictReasonEn" JSONB NOT NULL,
    "verdictReasonFr" JSONB NOT NULL,
    "actionEn" TEXT NOT NULL,
    "actionFr" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "signalsManifest" JSONB NOT NULL,
    "signalsHash" TEXT NOT NULL,
    "tigerScoreSnapshot" INTEGER,
    "mode" TEXT NOT NULL DEFAULT 'SHADOW',
    "investigatorId" TEXT,
    "latencyMs" INTEGER NOT NULL,
    "enginesVersion" TEXT NOT NULL,

    CONSTRAINT "ReflexAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NarrativeScript" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "keywords" JSONB NOT NULL,
    "regexes" JSONB NOT NULL,
    "derivedFrom" JSONB NOT NULL,
    "defaultConfidence" DOUBLE PRECISION NOT NULL,
    "severity" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NarrativeScript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReflexWatch" (
    "id" TEXT NOT NULL,
    "reflexAnalysisId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "chain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "triggerReason" TEXT,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ReflexWatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReflexAnalysis_inputResolvedAddress_idx" ON "ReflexAnalysis"("inputResolvedAddress");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReflexAnalysis_inputResolvedHandle_idx" ON "ReflexAnalysis"("inputResolvedHandle");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReflexAnalysis_verdict_idx" ON "ReflexAnalysis"("verdict");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReflexAnalysis_createdAt_idx" ON "ReflexAnalysis"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReflexAnalysis_mode_idx" ON "ReflexAnalysis"("mode");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NarrativeScript_code_key" ON "NarrativeScript"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NarrativeScript_active_idx" ON "NarrativeScript"("active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NarrativeScript_category_idx" ON "NarrativeScript"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReflexWatch_reflexAnalysisId_idx" ON "ReflexWatch"("reflexAnalysisId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReflexWatch_target_idx" ON "ReflexWatch"("target");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReflexWatch_status_idx" ON "ReflexWatch"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReflexWatch_nextCheckAt_idx" ON "ReflexWatch"("nextCheckAt");



COMMIT;
