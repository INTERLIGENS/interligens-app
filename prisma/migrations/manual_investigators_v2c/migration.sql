-- Manual migration for Investigators V2C
-- Apply via Neon SQL Editor. DO NOT run prisma db push.
-- Assumes V2A and V2B migrations have already been applied.

ALTER TABLE "VaultWorkspace"
  ADD COLUMN IF NOT EXISTS "assistantTokensUsed" INTEGER DEFAULT 0;

ALTER TABLE "VaultWorkspace"
  ADD COLUMN IF NOT EXISTS "assistantTokensLimit" INTEGER DEFAULT 100000;

CREATE TABLE IF NOT EXISTS "VaultCaseShare" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "entitySnapshot" JSONB NOT NULL,
  "titleSnapshot" TEXT NOT NULL,
  "hypothesisSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VaultCaseShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VaultCaseShare_token_key"
  ON "VaultCaseShare"("token");
CREATE INDEX IF NOT EXISTS "VaultCaseShare_caseId_idx"
  ON "VaultCaseShare"("caseId");
