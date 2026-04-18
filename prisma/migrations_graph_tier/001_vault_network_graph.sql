-- Migration 001 — Vault Network Graph (3-tier graph system)
--
-- ADDITIVE ONLY. Safe to run on prod.
-- Run this via the Neon SQL Editor against ep-square-band (see CLAUDE.md):
-- DO NOT use `prisma db push` or `prisma migrate deploy` on prod.
--
-- What this migration does:
--   1. Adds enum "VaultGraphVisibility" with values PRIVATE / TEAM_POOL / PUBLIC.
--   2. Adds table "VaultNetworkGraph" with FK → "VaultWorkspace"(id) ON DELETE CASCADE.
--   3. Adds indexes on workspaceId and visibility for dashboard/team-pool queries.
--
-- After running this SQL:
--   - Pull latest generated Prisma client: `npx prisma generate --schema=prisma/schema.prod.prisma`
--   - Deploy: `npx vercel --prod`

BEGIN;

DO $$ BEGIN
    CREATE TYPE "VaultGraphVisibility" AS ENUM ('PRIVATE', 'TEAM_POOL', 'PUBLIC');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "VaultNetworkGraph" (
    "id"          TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "visibility"  "VaultGraphVisibility" NOT NULL DEFAULT 'PRIVATE',
    "nodeCount"   INTEGER NOT NULL DEFAULT 0,
    "edgeCount"   INTEGER NOT NULL DEFAULT 0,
    "payloadEnc"  TEXT NOT NULL,
    "payloadIv"   TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "reviewedBy"  TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VaultNetworkGraph_workspaceId_fkey"
        FOREIGN KEY ("workspaceId")
        REFERENCES "VaultWorkspace"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "VaultNetworkGraph_workspaceId_idx"
    ON "VaultNetworkGraph"("workspaceId");

CREATE INDEX IF NOT EXISTS "VaultNetworkGraph_visibility_idx"
    ON "VaultNetworkGraph"("visibility");

COMMIT;
