-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION_kol_activity_profile_v1.sql
-- INTERLIGENS — KolActivityProfile (auto-vetting metrics, additive, shadow mode)
-- Run manually in the Neon SQL Editor (ep-square-band). Never prisma db push.
-- Author: David Pandora / INTERLIGENS  ·  Date: 2026-06-13
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;
CREATE TABLE IF NOT EXISTS "KolActivityProfile" (
  "id"                       TEXT PRIMARY KEY,
  "kolHandle"                TEXT NOT NULL UNIQUE,
  "computedAt"               TIMESTAMP(3) NOT NULL DEFAULT now(),
  "tweetsAnalyzed"           INTEGER NOT NULL DEFAULT 0,
  "periodDays"               DOUBLE PRECISION,
  "tweetsPerDay"             DOUBLE PRECISION,
  "uniqueTickers"            INTEGER,
  "uniqueCAs"                INTEGER,
  "mediaTweetRatio"          DOUBLE PRECISION,
  "mentionToFollowersRatio"  DOUBLE PRECISION,
  "shillLanguageScore"       INTEGER,
  "taLanguageScore"          INTEGER,
  "classification"           TEXT,
  "raw"                      JSONB
);
CREATE INDEX IF NOT EXISTS "KolActivityProfile_classification_idx" ON "KolActivityProfile" ("classification");
COMMIT;
-- Verify: SELECT "classification", COUNT(*) FROM "KolActivityProfile" GROUP BY 1;
