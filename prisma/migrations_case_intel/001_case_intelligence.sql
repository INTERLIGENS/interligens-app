-- Migration 001 — Case Intelligence Orchestrator
-- ADDITIVE ONLY. Run manually in the Neon SQL Editor against ep-square-band
-- (per CLAUDE.md: no `prisma db push` / `prisma migrate deploy` on prod).
--
-- 1. Adds the orchestrator tables.
-- 2. Adds assistance-level knobs to VaultWorkspace (all default to "ON" /
--    "QUIET" / "BALANCED" — pre-existing workspaces keep working without a
--    backfill).
-- After running: `npx prisma generate --schema=prisma/schema.prod.prisma`.

BEGIN;

-- ── VaultWorkspace: assistance knobs ─────────────────────────────────────
ALTER TABLE "VaultWorkspace"
    ADD COLUMN IF NOT EXISTS "assistanceLevel"          TEXT NOT NULL DEFAULT 'BALANCED',
    ADD COLUMN IF NOT EXISTS "autoKolRegistryMode"      TEXT NOT NULL DEFAULT 'ON',
    ADD COLUMN IF NOT EXISTS "autoObservedProceedsMode" TEXT NOT NULL DEFAULT 'ON',
    ADD COLUMN IF NOT EXISTS "autoLaundryTrailMode"     TEXT NOT NULL DEFAULT 'QUIET',
    ADD COLUMN IF NOT EXISTS "autoIntelVaultMode"       TEXT NOT NULL DEFAULT 'ON',
    ADD COLUMN IF NOT EXISTS "autoCaseCorrelationMode"  TEXT NOT NULL DEFAULT 'QUIET',
    ADD COLUMN IF NOT EXISTS "autoMarketMakerMode"      TEXT NOT NULL DEFAULT 'QUIET',
    ADD COLUMN IF NOT EXISTS "autoWalletJourneyMode"    TEXT NOT NULL DEFAULT 'ON',
    ADD COLUMN IF NOT EXISTS "autoNextStepsMode"        TEXT NOT NULL DEFAULT 'ON';

-- ── VaultCaseIntelligenceEvent ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "VaultCaseIntelligenceEvent" (
    "id"                       TEXT PRIMARY KEY,
    "caseId"                   TEXT NOT NULL,
    "workspaceId"              TEXT NOT NULL,
    "entityId"                 TEXT,
    "eventType"                TEXT NOT NULL,
    "sourceModule"             TEXT NOT NULL,
    "severity"                 TEXT NOT NULL,
    "title"                    TEXT NOT NULL,
    "summary"                  TEXT NOT NULL,
    "confidence"               DOUBLE PRECISION,
    "assistanceModeAtCreation" TEXT NOT NULL,
    "payload"                  JSONB NOT NULL,
    "isDismissed"              BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VaultCaseIntelligenceEvent_caseId_fkey"
        FOREIGN KEY ("caseId") REFERENCES "VaultCase"("id") ON DELETE CASCADE,
    CONSTRAINT "VaultCaseIntelligenceEvent_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "VaultWorkspace"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "VaultCaseIntelligenceEvent_caseId_createdAt_idx"
    ON "VaultCaseIntelligenceEvent"("caseId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "VaultCaseIntelligenceEvent_workspaceId_createdAt_idx"
    ON "VaultCaseIntelligenceEvent"("workspaceId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "VaultCaseIntelligenceEvent_caseId_dismiss_idx"
    ON "VaultCaseIntelligenceEvent"("caseId", "isDismissed", "createdAt" DESC);

-- ── VaultCaseIntelligenceSummary ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "VaultCaseIntelligenceSummary" (
    "caseId"               TEXT PRIMARY KEY,
    "strongestSignals"     JSONB NOT NULL DEFAULT '[]',
    "currentGaps"          JSONB NOT NULL DEFAULT '[]',
    "nextSuggestedActions" JSONB NOT NULL DEFAULT '[]',
    "publicationReadiness" JSONB NOT NULL DEFAULT '{}',
    "latestEventIds"       JSONB NOT NULL DEFAULT '[]',
    "lastOrchestratedAt"   TIMESTAMP(3),
    "orchestrationStatus"  TEXT NOT NULL DEFAULT 'IDLE',
    "lastFailedModules"    JSONB,
    "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VaultCaseIntelligenceSummary_caseId_fkey"
        FOREIGN KEY ("caseId") REFERENCES "VaultCase"("id") ON DELETE CASCADE
);

COMMIT;
