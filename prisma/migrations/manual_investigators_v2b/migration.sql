-- Manual migration for Investigators V2B
-- Apply via Neon SQL Editor. DO NOT run prisma db push.
-- Assumes V2A migration has already been applied.

CREATE TABLE IF NOT EXISTS "VaultTimelineEvent" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "eventDate" TIMESTAMP(3) NOT NULL,
  "entityIds" TEXT[],
  "eventType" TEXT NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VaultTimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VaultTimelineEvent_caseId_idx"
  ON "VaultTimelineEvent"("caseId");
CREATE INDEX IF NOT EXISTS "VaultTimelineEvent_eventDate_idx"
  ON "VaultTimelineEvent"("eventDate");

DO $$ BEGIN
  ALTER TABLE "VaultTimelineEvent"
    ADD CONSTRAINT "VaultTimelineEvent_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "VaultCase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "VaultPublishCandidate" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "entityIds" TEXT[],
  "summary" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  CONSTRAINT "VaultPublishCandidate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VaultPublishCandidate_caseId_idx"
  ON "VaultPublishCandidate"("caseId");
CREATE INDEX IF NOT EXISTS "VaultPublishCandidate_status_idx"
  ON "VaultPublishCandidate"("status");

DO $$ BEGIN
  ALTER TABLE "VaultPublishCandidate"
    ADD CONSTRAINT "VaultPublishCandidate_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "VaultCase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
