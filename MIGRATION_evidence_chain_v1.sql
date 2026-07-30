-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION_evidence_chain_v1.sql
-- INTERLIGENS — CC-OFFLINE-54 — Chaîne de preuve V1 (additif, shadow).
-- Run manually in the Neon SQL Editor (ep-square-band). NEVER prisma db push.
-- Author: INTERLIGENS  ·  Date: 2026-07-30
--
-- Une capture (EvidenceItem) porte PLUSIEURS EvidenceLink.
-- sourceType/linkType/corroborationLevel/action = TEXT (énumération côté TS).
-- tsaToken = BYTEA (réponse RFC3161 complète). Rétention R2 dégradée
-- (object lock indisponible, cf. rapport Phase 0.4) → immutableStored default false.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

CREATE TABLE IF NOT EXISTS "EvidenceItem" (
  "id"                 TEXT PRIMARY KEY,
  "casefileId"         TEXT,
  "r2Key"              TEXT,
  "filePath"           TEXT,
  "mimeType"           TEXT,
  "byteSize"           INTEGER,
  "sha256"             TEXT NOT NULL,
  "capturedAt"         TIMESTAMP(3),
  "capturedBy"         TEXT,
  "captureHost"        TEXT,
  "captureTool"        TEXT,
  "captureToolVersion" TEXT,
  "sourceUrl"          TEXT,
  "sourceType"         TEXT NOT NULL DEFAULT 'OTHER',
  "ingestedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tsaToken"           BYTEA,
  "tsaProvider"        TEXT,
  "tsaTimestampedAt"   TIMESTAMP(3),
  "tsaCertChain"       TEXT,   -- PEM chain (signer+intermediates+root) archived at stamping → offline verify
  "immutableStored"    BOOLEAN NOT NULL DEFAULT false,
  "immutableRef"       TEXT,
  "notes"              TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "EvidenceItem_sha256_key"       ON "EvidenceItem" ("sha256");
CREATE INDEX        IF NOT EXISTS "EvidenceItem_casefileId_idx"   ON "EvidenceItem" ("casefileId");
CREATE INDEX        IF NOT EXISTS "EvidenceItem_sourceType_idx"   ON "EvidenceItem" ("sourceType");
-- Idempotent : si la table préexiste d'un run partiel, garantir la colonne chaîne.
ALTER TABLE "EvidenceItem" ADD COLUMN IF NOT EXISTS "tsaCertChain" TEXT;

CREATE TABLE IF NOT EXISTS "EvidenceLink" (
  "id"                 TEXT PRIMARY KEY,
  "evidenceItemId"     TEXT NOT NULL,
  "linkType"           TEXT NOT NULL,
  "externalId"         TEXT,
  "externalUrl"        TEXT,
  "corroborationLevel" TEXT NOT NULL DEFAULT 'NONE',
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceLink_evidenceItemId_fkey"
    FOREIGN KEY ("evidenceItemId") REFERENCES "EvidenceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "EvidenceLink_evidenceItemId_idx"      ON "EvidenceLink" ("evidenceItemId");
CREATE INDEX IF NOT EXISTS "EvidenceLink_linkType_externalId_idx" ON "EvidenceLink" ("linkType", "externalId");

CREATE TABLE IF NOT EXISTS "EvidenceAccessLog" (
  "id"             TEXT PRIMARY KEY,
  "evidenceItemId" TEXT NOT NULL,
  "action"         TEXT NOT NULL,
  "actor"          TEXT,
  "at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "context"        TEXT,
  CONSTRAINT "EvidenceAccessLog_evidenceItemId_fkey"
    FOREIGN KEY ("evidenceItemId") REFERENCES "EvidenceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "EvidenceAccessLog_evidenceItemId_at_idx" ON "EvidenceAccessLog" ("evidenceItemId", "at");

COMMIT;
-- Verify: SELECT COUNT(*) FROM "EvidenceItem"; SELECT COUNT(*) FROM "EvidenceLink"; SELECT COUNT(*) FROM "EvidenceAccessLog";
