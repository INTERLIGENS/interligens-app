-- Founder Intel Feed — manual migration
-- Apply via Neon SQL Editor on ep-square-band. Additive only, no destructive ops.
-- Safe to run multiple times (IF NOT EXISTS guards).

-- ── Enums ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "IntelCategory" AS ENUM ('SCAM', 'COMPETITOR', 'AI', 'REGULATORY', 'ECOSYSTEM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "IntelPriority" AS ENUM ('HIGH', 'NORMAL', 'LOW');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "IntelSourceType" AS ENUM ('RSS', 'X_HANDLE', 'WEBHOOK');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "IntelRunStatus" AS ENUM ('RUNNING', 'DONE', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── FounderIntelSource ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "FounderIntelSource" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "type"       "IntelSourceType" NOT NULL,
  "url"        TEXT,
  "handle"     TEXT,
  "category"   "IntelCategory" NOT NULL,
  "trustScore" INTEGER NOT NULL DEFAULT 3,
  "enabled"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FounderIntelSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FounderIntelSource_url_key" ON "FounderIntelSource"("url");
CREATE UNIQUE INDEX IF NOT EXISTS "FounderIntelSource_handle_key" ON "FounderIntelSource"("handle");

-- ── FounderIntelItem ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "FounderIntelItem" (
  "id"               TEXT NOT NULL,
  "dedupKey"         TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "excerpt"          TEXT,
  "summary"          TEXT,
  "summaryDone"      BOOLEAN NOT NULL DEFAULT false,
  "summaryAttempts"  INTEGER NOT NULL DEFAULT 0,
  "lastSummaryError" TEXT,
  "url"              TEXT NOT NULL,
  "canonicalUrl"     TEXT,
  "sourceItemId"     TEXT,
  "contentHash"      TEXT,
  "author"           TEXT,
  "imageUrl"         TEXT,
  "lang"             TEXT,
  "chain"            TEXT,
  "source"           TEXT NOT NULL,
  "sourceId"         TEXT,
  "category"         "IntelCategory" NOT NULL,
  "priority"         "IntelPriority" NOT NULL DEFAULT 'NORMAL',
  "tags"             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "starRating"       INTEGER NOT NULL DEFAULT 0,
  "starOverride"     INTEGER,
  "read"             BOOLEAN NOT NULL DEFAULT false,
  "starred"          BOOLEAN NOT NULL DEFAULT false,
  "publishedAt"      TIMESTAMP(3) NOT NULL,
  "fetchedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FounderIntelItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FounderIntelItem_dedupKey_key" ON "FounderIntelItem"("dedupKey");
CREATE INDEX IF NOT EXISTS "FounderIntelItem_contentHash_idx" ON "FounderIntelItem"("contentHash");
CREATE INDEX IF NOT EXISTS "FounderIntelItem_category_publishedAt_idx" ON "FounderIntelItem"("category", "publishedAt");
CREATE INDEX IF NOT EXISTS "FounderIntelItem_starRating_publishedAt_idx" ON "FounderIntelItem"("starRating", "publishedAt");
CREATE INDEX IF NOT EXISTS "FounderIntelItem_read_publishedAt_idx" ON "FounderIntelItem"("read", "publishedAt");
CREATE INDEX IF NOT EXISTS "FounderIntelItem_summaryDone_summaryAttempts_idx" ON "FounderIntelItem"("summaryDone", "summaryAttempts");

DO $$ BEGIN
  ALTER TABLE "FounderIntelItem"
    ADD CONSTRAINT "FounderIntelItem_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "FounderIntelSource"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── FounderIntelIngestRun ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "FounderIntelIngestRun" (
  "id"            TEXT NOT NULL,
  "startedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"   TIMESTAMP(3),
  "sourceCount"   INTEGER NOT NULL DEFAULT 0,
  "itemsIngested" INTEGER NOT NULL DEFAULT 0,
  "errors"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status"        "IntelRunStatus" NOT NULL DEFAULT 'RUNNING',
  CONSTRAINT "FounderIntelIngestRun_pkey" PRIMARY KEY ("id")
);
