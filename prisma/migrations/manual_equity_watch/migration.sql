-- ============================================================================
-- Migration: add EquitySignal table
-- Target:    ep-square-band Neon (production)
-- Safety:    ADDITIVE. No column modified, no data touched. Idempotent.
-- Source:    prisma/schema.prod.prisma (model EquitySignal)
-- ============================================================================
--
-- STEP 1. Open Neon SQL Editor on ep-square-band.
-- STEP 2. Paste the block below and run it.
-- STEP 3. Verify with the SELECT at the bottom.
-- STEP 4. On the dev machine: `npx prisma generate --schema=prisma/schema.prod.prisma`
--         so the Prisma Client picks up the new delegate.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "EquitySignal" (
  "id"           TEXT         NOT NULL,
  "ticker"       TEXT         NOT NULL,
  "entityName"   TEXT         NOT NULL,
  "tradeDate"    TIMESTAMP(3) NOT NULL,
  "tweetDate"    TIMESTAMP(3),
  "deltaHours"   DOUBLE PRECISION,
  "suspectLevel" TEXT         NOT NULL DEFAULT 'LOW',
  "notes"        TEXT,
  "source"       TEXT         NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EquitySignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EquitySignal_ticker_idx"
  ON "EquitySignal"("ticker");

CREATE INDEX IF NOT EXISTS "EquitySignal_createdAt_idx"
  ON "EquitySignal"("createdAt");

COMMIT;

-- Verification — fresh table, expect 0 rows and the correct column shape.
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_name = 'EquitySignal'
 ORDER BY ordinal_position;

SELECT COUNT(*) AS row_count FROM "EquitySignal";
