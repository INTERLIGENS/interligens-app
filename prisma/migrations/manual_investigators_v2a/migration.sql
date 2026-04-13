-- Manual migration for Investigators V2A
-- Apply via Neon SQL Editor. DO NOT run prisma db push.

ALTER TABLE "VaultCase" ADD COLUMN IF NOT EXISTS "caseTemplate" TEXT DEFAULT 'blank';

DO $$ BEGIN
  CREATE TYPE "VaultHypothesisStatus" AS ENUM ('OPEN','CONFIRMED','REFUTED','NEEDS_VERIFICATION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "VaultHypothesis" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "VaultHypothesisStatus" NOT NULL DEFAULT 'OPEN',
  "confidence" INTEGER NOT NULL DEFAULT 50,
  "supportingEntityIds" TEXT[],
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VaultHypothesis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VaultHypothesis_caseId_idx" ON "VaultHypothesis"("caseId");

DO $$ BEGIN
  ALTER TABLE "VaultHypothesis"
    ADD CONSTRAINT "VaultHypothesis_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "VaultCase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
