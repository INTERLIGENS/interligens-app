-- AdminDocument — manual migration.
-- Apply via Neon SQL Editor on ep-square-band. Additive only.
-- Idempotent (IF NOT EXISTS guards).

CREATE TABLE IF NOT EXISTS "AdminDocument" (
  "id"          TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "category"    TEXT NOT NULL,
  "version"     TEXT,
  "r2Key"       TEXT,
  "r2Url"       TEXT,
  "status"      TEXT NOT NULL DEFAULT 'pending',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminDocument_category_idx"
  ON "AdminDocument"("category");

CREATE INDEX IF NOT EXISTS "AdminDocument_createdAt_idx"
  ON "AdminDocument"("createdAt" DESC);
