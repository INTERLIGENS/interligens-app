ALTER TABLE "KolProfile" ADD COLUMN IF NOT EXISTS "evmAddress" TEXT;
ALTER TABLE "KolProfile" ADD COLUMN IF NOT EXISTS "exitDate" TIMESTAMP;
ALTER TABLE "KolProfile" ADD COLUMN IF NOT EXISTS "exitPostUrl" TEXT;
ALTER TABLE "KolProfile" ADD COLUMN IF NOT EXISTS "exitNarrative" TEXT;
ALTER TABLE "KolProfile" ADD COLUMN IF NOT EXISTS "totalDocumented" FLOAT DEFAULT 0;

CREATE TABLE IF NOT EXISTS "KolEvidence" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "kolHandle" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "wallets" TEXT NOT NULL DEFAULT '[]',
  "amountUsd" FLOAT,
  "txCount" INTEGER DEFAULT 0,
  "dateFirst" TIMESTAMP,
  "dateLast" TIMESTAMP,
  "token" TEXT,
  "sampleTx" TEXT,
  "sourceUrl" TEXT,
  "twitterPost" TEXT,
  "postTimestamp" TIMESTAMP,
  "deltaMinutes" INTEGER,
  "rawJson" TEXT,
  CONSTRAINT "KolEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KolEvidence_kolHandle_fkey" FOREIGN KEY ("kolHandle") REFERENCES "KolProfile"("handle") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "KolEvidence_kolHandle_idx" ON "KolEvidence"("kolHandle");
