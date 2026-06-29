-- ════════════════════════════════════════════════════════════════════
-- MIGRATION: Bridge cron safety layer — JobRunLog
-- Audit log of bridge job runs (incl. dry-runs and disabled no-ops). ADDITIF
-- seul, applied to Neon ep-square-band via raw connection (never prisma db push).
-- `limit` is a reserved SQL word → column "limitN".
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "JobRunLog" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "jobName"       TEXT NOT NULL,
  "dryRun"        BOOLEAN NOT NULL DEFAULT false,
  "startedAt"     TIMESTAMP NOT NULL DEFAULT now(),
  "finishedAt"    TIMESTAMP,
  "status"        TEXT NOT NULL DEFAULT 'running',   -- running | success | error | disabled
  "limitN"        INTEGER,
  "processed"     INTEGER NOT NULL DEFAULT 0,
  "createdDrafts" INTEGER NOT NULL DEFAULT 0,
  "ambiguous"     INTEGER NOT NULL DEFAULT 0,
  "conflicts"     INTEGER NOT NULL DEFAULT 0,
  "errors"        INTEGER NOT NULL DEFAULT 0,
  "summaryJson"   JSONB
);

CREATE INDEX IF NOT EXISTS "JobRunLog_jobName_startedAt_idx" ON "JobRunLog" ("jobName", "startedAt" DESC);
