-- Threads X module. Additive only. Safe to re-run.
-- Apply via Neon SQL Editor (ep-square-band).

CREATE TABLE IF NOT EXISTS "XThread" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "target" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "body" TEXT NOT NULL,
  "scheduledAt" TIMESTAMPTZ,
  "publishedAt" TIMESTAMPTZ,
  "tweetUrl" TEXT,
  "impressions" INTEGER,
  "retweets" INTEGER,
  "likes" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "XThread_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "XThread_status_idx" ON "XThread"("status");
