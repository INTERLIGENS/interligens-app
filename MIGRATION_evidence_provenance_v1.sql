-- MIGRATION_evidence_provenance_v1.sql — CC-OFFLINE-56
-- Provenance des pièces de la chaîne de preuve. STRICTEMENT ADDITIF, idempotent,
-- rejouable. À exécuter dans le Neon SQL Editor (ep-square-band) UNIQUEMENT.
-- ✅ APPLIQUÉE par David le 2026-08-13 (contrôles : 1070 / 0 / 3 confirmés).
--
-- Aucun DEFAULT (un défaut mentirait sur la provenance), aucun NOT NULL, aucun
-- UPDATE : les 1070 pièces pré-provenance restent NULL = legacy (Option A,
-- zéro réécriture — argument de custody « jamais réécrites »). Le manifeste les
-- expose comme MIGRATED_BACKFILL par dérivation, timestampMode depuis le
-- marqueur notes [TIMESTAMP:RETROACTIVE].
--
-- Valeurs (énums côté TS — src/lib/evidence-chain/types.ts — pas d'enum PG) :
--   provenanceType : FIRST_PARTY_CAPTURE | THIRD_PARTY_SUBMISSION | MIGRATED_BACKFILL
--   timestampMode  : at-capture | retroactive | at-ingestion
--   submittedBy    : identité pseudonyme du soumetteur (ipHash retail), sinon NULL

ALTER TABLE "EvidenceItem" ADD COLUMN IF NOT EXISTS "provenanceType" TEXT;
ALTER TABLE "EvidenceItem" ADD COLUMN IF NOT EXISTS "submittedBy"    TEXT;
ALTER TABLE "EvidenceItem" ADD COLUMN IF NOT EXISTS "timestampMode"  TEXT;

CREATE INDEX IF NOT EXISTS "EvidenceItem_provenanceType_idx"
  ON "EvidenceItem" ("provenanceType");

-- Contrôles post-migration (lecture seule) :
--   SELECT count(*) FROM "EvidenceItem";                                      -- 1070 (au 2026-08-13)
--   SELECT count(*) FROM "EvidenceItem" WHERE "provenanceType" IS NOT NULL;   -- 0 (legacy jamais réécrit)
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'EvidenceItem'
--      AND column_name IN ('provenanceType','submittedBy','timestampMode');   -- 3 lignes
