-- Migration: Vault Evidence Snapshots (V1)
-- Apply via Neon SQL Editor. DO NOT run prisma db push.
-- Additive only — no destructive changes.

DO $$ BEGIN
  CREATE TYPE "VaultEvidenceSourceType" AS ENUM (
    'WEBSITE', 'X_POST', 'TELEGRAM', 'DISCORD', 'GITHUB', 'MEDIUM',
    'WHITEPAPER', 'EXPLORER', 'ARKHAM', 'METASLEUTH', 'DUNE',
    'CHAINABUSE', 'GOPLUS', 'SCAMSNIFFER', 'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "VaultEvidencePublishability" AS ENUM (
    'PRIVATE', 'SHAREABLE', 'PUBLISHABLE', 'REDACTED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "VaultEvidenceSnapshot" (
  "id"                   TEXT           NOT NULL,
  "caseId"               TEXT           NOT NULL,
  "workspaceId"          TEXT           NOT NULL,
  "investigatorAccessId" TEXT           NOT NULL,
  "url"                  TEXT,
  "title"                TEXT           NOT NULL,
  "sourceType"           "VaultEvidenceSourceType"     NOT NULL DEFAULT 'OTHER',
  "note"                 TEXT,
  "tags"                 TEXT[]         NOT NULL DEFAULT '{}',
  "relatedEntityId"      TEXT,
  "publishability"       "VaultEvidencePublishability" NOT NULL DEFAULT 'PRIVATE',
  "contentHashSha256"    TEXT           NOT NULL,
  "capturedAt"           TIMESTAMP(3)   NOT NULL,
  "createdAt"            TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VaultEvidenceSnapshot_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "VaultEvidenceSnapshot"
    ADD CONSTRAINT "VaultEvidenceSnapshot_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "VaultCase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "VaultEvidenceSnapshot_caseId_idx"
  ON "VaultEvidenceSnapshot"("caseId");
CREATE INDEX IF NOT EXISTS "VaultEvidenceSnapshot_workspaceId_idx"
  ON "VaultEvidenceSnapshot"("workspaceId");
CREATE INDEX IF NOT EXISTS "VaultEvidenceSnapshot_publishability_idx"
  ON "VaultEvidenceSnapshot"("publishability");
