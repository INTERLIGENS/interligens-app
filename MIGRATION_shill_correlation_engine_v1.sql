-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION_shill_correlation_engine_v1.sql
-- INTERLIGENS — Shill Correlation Engine (Shadow Mode)
--
-- Adds 3 new tables for the internal shill-correlation engine:
--   • ShillEvent                — one normalized (KOL, tweet, token) event
--   • ShillBuyerObservation     — one wallet observation around a shill event
--   • ShillCorrelationCandidate — aggregated (KOL, wallet) candidate + scores
--
-- Run manually in the Neon SQL Editor against the production Default branch
-- (ep-square-band). Never `prisma db push`. Idempotent: re-runs are safe
-- thanks to IF NOT EXISTS clauses on tables and indexes.
--
-- Author: David Pandora / INTERLIGENS
-- Date  : 2026-06-09
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── ShillEvent ──────────────────────────────────────────────────────────────
-- One row per normalized (kolHandle, tweetId, tokenMint).
-- Lifecycle: pending → buyers_fetched → scored | errored.

CREATE TABLE IF NOT EXISTS "ShillEvent" (
    "id"                    TEXT         NOT NULL,
    "kolHandle"             TEXT         NOT NULL,
    "tweetId"               TEXT         NOT NULL,
    "tweetTimestamp"        TIMESTAMP(3) NOT NULL,
    "tokenMint"             TEXT         NOT NULL,
    "chain"                 TEXT         NOT NULL,
    "sourcePostCandidateId" TEXT,
    "campaignId"            TEXT,
    "processingStatus"      TEXT         NOT NULL DEFAULT 'pending',
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShillEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShillEvent_kolHandle_tweetId_tokenMint_key"
    ON "ShillEvent" ("kolHandle", "tweetId", "tokenMint");

CREATE INDEX IF NOT EXISTS "ShillEvent_processingStatus_tweetTimestamp_idx"
    ON "ShillEvent" ("processingStatus", "tweetTimestamp");

CREATE INDEX IF NOT EXISTS "ShillEvent_kolHandle_tweetTimestamp_idx"
    ON "ShillEvent" ("kolHandle", "tweetTimestamp" DESC);

CREATE INDEX IF NOT EXISTS "ShillEvent_chain_tokenMint_idx"
    ON "ShillEvent" ("chain", "tokenMint");

CREATE INDEX IF NOT EXISTS "ShillEvent_sourcePostCandidateId_idx"
    ON "ShillEvent" ("sourcePostCandidateId");

-- ─── ShillBuyerObservation ───────────────────────────────────────────────────
-- One row per (shillEvent, wallet). Earliest observed entry inside the
-- analysis window (-10m … +15m around tweet).

CREATE TABLE IF NOT EXISTS "ShillBuyerObservation" (
    "id"                    TEXT           NOT NULL,
    "shillEventId"          TEXT           NOT NULL,
    "wallet"                TEXT           NOT NULL,
    "chain"                 TEXT           NOT NULL,
    "firstSeenAt"           TIMESTAMP(3)   NOT NULL,
    "deltaSecondsFromTweet" INTEGER        NOT NULL,
    "entryAmountToken"      DECIMAL(38,9),
    "entryAmountUsd"        DECIMAL(20,2),
    "exitAmountUsd"         DECIMAL(20,2),
    "exitDeltaSeconds"      INTEGER,
    "behaviorZone"          TEXT           NOT NULL,
    "behaviorType"          TEXT           NOT NULL,
    "isAmbiguous"           BOOLEAN        NOT NULL DEFAULT false,
    "firstBuyTxSignature"   TEXT,
    "notes"                 TEXT,
    "createdAt"             TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShillBuyerObservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShillBuyerObservation_shillEventId_wallet_key"
    ON "ShillBuyerObservation" ("shillEventId", "wallet");

CREATE INDEX IF NOT EXISTS "ShillBuyerObservation_wallet_chain_idx"
    ON "ShillBuyerObservation" ("wallet", "chain");

CREATE INDEX IF NOT EXISTS "ShillBuyerObservation_shillEventId_behaviorZone_idx"
    ON "ShillBuyerObservation" ("shillEventId", "behaviorZone");

-- ON DELETE CASCADE: if a ShillEvent is deleted (rare admin cleanup) the
-- observations follow it.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ShillBuyerObservation_shillEventId_fkey'
    ) THEN
        ALTER TABLE "ShillBuyerObservation"
            ADD CONSTRAINT "ShillBuyerObservation_shillEventId_fkey"
            FOREIGN KEY ("shillEventId") REFERENCES "ShillEvent"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ─── ShillCorrelationCandidate ───────────────────────────────────────────────
-- Aggregated (kolHandle, wallet, chain). Scores are NUMERIC(6,2) so the
-- engine can use 0.00–100.00 scales without losing precision.
-- ratioObserved is NUMERIC(5,4) = 0.0000–1.0000.

CREATE TABLE IF NOT EXISTS "ShillCorrelationCandidate" (
    "id"                   TEXT          NOT NULL,
    "kolHandle"            TEXT          NOT NULL,
    "wallet"               TEXT          NOT NULL,
    "chain"                TEXT          NOT NULL,
    "observedShillCount"   INTEGER       NOT NULL DEFAULT 0,
    "analyzableShillCount" INTEGER       NOT NULL DEFAULT 0,
    "ratioObserved"        DECIMAL(5,4)  NOT NULL DEFAULT 0,
    "preTweetCount"        INTEGER       NOT NULL DEFAULT 0,
    "nearTweetCount"       INTEGER       NOT NULL DEFAULT 0,
    "postTweetCount"       INTEGER       NOT NULL DEFAULT 0,
    "recurrenceScore"      DECIMAL(6,2)  NOT NULL DEFAULT 0,
    "specificityScore"     DECIMAL(6,2)  NOT NULL DEFAULT 0,
    "timingScore"          DECIMAL(6,2)  NOT NULL DEFAULT 0,
    "exitScore"            DECIMAL(6,2)  NOT NULL DEFAULT 0,
    "genericSniperPenalty" DECIMAL(6,2)  NOT NULL DEFAULT 0,
    "correlationScore"     DECIMAL(6,2)  NOT NULL DEFAULT 0,
    "confidence"           TEXT          NOT NULL DEFAULT 'low',
    "classification"       TEXT          NOT NULL DEFAULT 'watch',
    "reviewStatus"         TEXT          NOT NULL DEFAULT 'draft',
    "firstSeenAt"          TIMESTAMP(3)  NOT NULL,
    "lastSeenAt"           TIMESTAMP(3)  NOT NULL,
    "notes"                TEXT,
    "createdAt"            TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "ShillCorrelationCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShillCorrelationCandidate_kolHandle_wallet_chain_key"
    ON "ShillCorrelationCandidate" ("kolHandle", "wallet", "chain");

CREATE INDEX IF NOT EXISTS "ShillCorrelationCandidate_kolHandle_correlationScore_idx"
    ON "ShillCorrelationCandidate" ("kolHandle", "correlationScore" DESC);

CREATE INDEX IF NOT EXISTS "ShillCorrelationCandidate_wallet_chain_idx"
    ON "ShillCorrelationCandidate" ("wallet", "chain");

CREATE INDEX IF NOT EXISTS "ShillCorrelationCandidate_classification_correlationScore_idx"
    ON "ShillCorrelationCandidate" ("classification", "correlationScore" DESC);

CREATE INDEX IF NOT EXISTS "ShillCorrelationCandidate_reviewStatus_correlationScore_idx"
    ON "ShillCorrelationCandidate" ("reviewStatus", "correlationScore" DESC);

COMMIT;

-- ─── Verification queries (run after COMMIT to confirm) ──────────────────────
-- SELECT COUNT(*) AS shill_events_count           FROM "ShillEvent";
-- SELECT COUNT(*) AS buyer_observations_count     FROM "ShillBuyerObservation";
-- SELECT COUNT(*) AS correlation_candidates_count FROM "ShillCorrelationCandidate";
--
-- SELECT indexname FROM pg_indexes WHERE tablename IN
--     ('ShillEvent', 'ShillBuyerObservation', 'ShillCorrelationCandidate')
-- ORDER BY tablename, indexname;
