-- ════════════════════════════════════════════════════════════════════
-- MIGRATION: Evidence Intake Bridge — Sprint 1 (schema, ADDITIF seul)
-- Cible: Neon ep-square-band. Appliqué via connexion SQL brute (jamais
-- prisma db push). Aucune colonne supprimée, aucun filtre de lecture touché.
-- reviewStatus d'EvidenceSnapshot volontairement NON modifié (existe déjà,
-- default 'pending'). Baseline counts: KolTokenLink=187, EvidenceSnapshot=945.
-- ════════════════════════════════════════════════════════════════════

-- ── A. KolTokenLink : 15 colonnes neuves ────────────────────────────
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "visibility"                TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "reviewStatus"              TEXT NOT NULL DEFAULT 'approved_public';
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "sourceType"                TEXT;
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "sourceRefId"               TEXT;
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "watcherCampaignId"         TEXT;
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "socialPostCandidateId"     TEXT;
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "canonicalChain"            TEXT;
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "canonicalMint"             TEXT;
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "tokenResolutionConfidence" TEXT;
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "tokenResolutionStatus"     TEXT;
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "evidenceSnapshotId"        TEXT;
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "reviewedBy"                TEXT;
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "reviewedAt"                TIMESTAMP;
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "reviewNote"                TEXT;
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "createdByBridge"           BOOLEAN NOT NULL DEFAULT false;

-- ── B. EvidenceSnapshot : 6 colonnes neuves (reviewStatus SKIP — existe) ──
ALTER TABLE "EvidenceSnapshot" ADD COLUMN IF NOT EXISTS "evidenceLevel"  TEXT;
ALTER TABLE "EvidenceSnapshot" ADD COLUMN IF NOT EXISTS "sourceType"     TEXT;
ALTER TABLE "EvidenceSnapshot" ADD COLUMN IF NOT EXISTS "sourceRefId"    TEXT;
ALTER TABLE "EvidenceSnapshot" ADD COLUMN IF NOT EXISTS "canonicalMint"  TEXT;
ALTER TABLE "EvidenceSnapshot" ADD COLUMN IF NOT EXISTS "captureQuality" TEXT;
ALTER TABLE "EvidenceSnapshot" ADD COLUMN IF NOT EXISTS "hashStatus"     TEXT;

-- ── C. SignalIntake : table neuve ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "SignalIntake" (
  "id"                        TEXT PRIMARY KEY,
  "sourceType"                TEXT NOT NULL,
  "sourceRefId"               TEXT,
  "status"                    TEXT NOT NULL DEFAULT 'new',
  "visibility"                TEXT NOT NULL DEFAULT 'internal',
  "rawText"                   TEXT,
  "detectedSymbols"           TEXT[],
  "detectedAddresses"         TEXT[],
  "detectedUrls"              TEXT[],
  "kolHandle"                 TEXT,
  "submittedByUserId"         TEXT,
  "canonicalChain"            TEXT,
  "canonicalMint"             TEXT,
  "tokenResolutionStatus"     TEXT,
  "tokenResolutionConfidence" TEXT,
  "tokenResolutionMethod"     TEXT,
  "signalScore"               INTEGER,
  "priority"                  TEXT,
  "evidenceSnapshotId"        TEXT,
  "kolTokenLinkId"            TEXT,
  "watcherCampaignId"         TEXT,
  "createdAt"                 TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"                 TIMESTAMP NOT NULL DEFAULT now(),
  "reviewedBy"                TEXT,
  "reviewedAt"                TIMESTAMP,
  "reviewNote"                TEXT
);

-- ── D. BACKFILL (sécurise les 187 lignes KolTokenLink existantes) ───
UPDATE "KolTokenLink"
   SET "visibility"      = 'public',
       "reviewStatus"    = 'approved_public',
       "sourceType"      = COALESCE("sourceType", 'manual_seed'),
       "createdByBridge" = false
 WHERE "visibility" IS NULL OR "sourceType" IS NULL;
