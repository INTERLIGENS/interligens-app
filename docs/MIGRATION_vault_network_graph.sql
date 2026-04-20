-- ============================================================================
-- Migration: add VaultNetworkGraph table + VaultGraphVisibility enum
-- Target database: ep-square-band-ag2lxpz8.c-2.eu-central-1.aws.neon.tech
-- Safety: ADDITIVE ONLY. No existing column is modified, no data is touched.
--         Safe to apply while the app is serving traffic.
-- Applies to: prisma/schema.prod.prisma changes committed in the investigators
--             finalisation sprint (feat/investigators-finalisation-pre-audit).
-- ============================================================================
--
-- STEP 1. Open the Neon Console SQL Editor on the ep-square-band project.
-- STEP 2. Paste the full block below and run it.
-- STEP 3. Verify with the two SELECTs at the bottom.
-- STEP 4. Back on your workstation, run:
--           npx prisma generate --schema=prisma/schema.prod.prisma
--         This regenerates the Prisma Client types so the API routes type-
--         check against the new model.
--
-- If anything fails mid-way, the transaction rolls back automatically.
-- ============================================================================

BEGIN;

-- Enum (matches Prisma `enum VaultGraphVisibility { PRIVATE TEAM_POOL PUBLIC }`)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'VaultGraphVisibility'
  ) THEN
    CREATE TYPE "VaultGraphVisibility" AS ENUM ('PRIVATE', 'TEAM_POOL', 'PUBLIC');
  END IF;
END$$;

-- Main table
CREATE TABLE IF NOT EXISTS "VaultNetworkGraph" (
  "id"          TEXT                   NOT NULL,
  "workspaceId" TEXT                   NOT NULL,
  "title"       TEXT                   NOT NULL,
  "description" TEXT,
  "visibility"  "VaultGraphVisibility" NOT NULL DEFAULT 'PRIVATE',
  "nodeCount"   INTEGER                NOT NULL DEFAULT 0,
  "edgeCount"   INTEGER                NOT NULL DEFAULT 0,
  "payloadEnc"  TEXT                   NOT NULL,
  "payloadIv"   TEXT                   NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "reviewedBy"  TEXT,
  "createdAt"   TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)           NOT NULL,
  CONSTRAINT "VaultNetworkGraph_pkey" PRIMARY KEY ("id")
);

-- FK to VaultWorkspace (cascade on workspace delete — matches Prisma relation).
-- Using a DO block so re-runs don't error on "constraint already exists".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'VaultNetworkGraph_workspaceId_fkey'
  ) THEN
    ALTER TABLE "VaultNetworkGraph"
      ADD CONSTRAINT "VaultNetworkGraph_workspaceId_fkey"
      FOREIGN KEY ("workspaceId")
      REFERENCES "VaultWorkspace"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END$$;

-- Indexes (match @@index in Prisma).
CREATE INDEX IF NOT EXISTS "VaultNetworkGraph_workspaceId_idx"
  ON "VaultNetworkGraph"("workspaceId");

CREATE INDEX IF NOT EXISTS "VaultNetworkGraph_visibility_idx"
  ON "VaultNetworkGraph"("visibility");

COMMIT;

-- ============================================================================
-- Verification queries (run after COMMIT). Both should return 0 rows.
-- ============================================================================

-- 1. Column shape matches the Prisma model.
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_name = 'VaultNetworkGraph'
 ORDER BY ordinal_position;

-- 2. Row count — brand-new table, should be 0.
SELECT COUNT(*) AS row_count FROM "VaultNetworkGraph";

-- 3. Confirm the enum values are present.
SELECT enumlabel
  FROM pg_enum
  JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
 WHERE pg_type.typname = 'VaultGraphVisibility'
 ORDER BY enumsortorder;
