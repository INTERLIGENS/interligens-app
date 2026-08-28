-- ═══════════════════════════════════════════════════════════════════════════
-- S3 · TABLE 4/5 — EvidenceItem · régime ROW · 1 104 lignes
--
-- M6, et le fichier le plus PRUDENT du pack. La table est probatoire : c'est
-- la chaîne de possession. Une nature inventée ici vaudrait pire que pas de
-- nature du tout — elle donnerait à une pièce non classée l'apparence d'une
-- pièce qualifiée.
--
-- Mesuré le 2026-08-28 :
--     provenanceType   NULL 1 070 · MIGRATED_BACKFILL 32 · FIRST_PARTY_CAPTURE 2
--     sourceType       X_POST 995 · OTHER 56 · GENERATED_CASE_PDF 32
--                      EXPLORER 18 · REPO_ARTIFACT 3
--
-- ─── CE QUI EST BACKFILLÉ : 2 LIGNES. C'EST TOUT. ─────────────────────────
-- Seul FIRST_PARTY_CAPTURE porte une nature déductible sans arbitrage : une
-- capture de première main EST une observation primaire.
--
-- MIGRATED_BACKFILL (32) n'est PAS mappé, délibérément. Cette valeur décrit
-- COMMENT la ligne est arrivée en base, pas CE QU'ELLE EST. Deux pièces
-- migrées par le même backfill peuvent être l'une une capture, l'autre un PDF
-- généré. Leur donner une nature commune serait exactement l'erreur
-- MmClaimType.FACT (§Q6) : un UPDATE global qui se trompe sur une partie des
-- lignes. Elles restent UNCLASSIFIED jusqu'à classement humain.
--
-- Les 1 070 NULL demandent le même classement, table par table de sourceType.
-- Ce n'est pas de la migration, c'est du travail d'instruction.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "EvidenceItem" ADD COLUMN IF NOT EXISTS "rowNature" "DataNature";

-- 1. Le seul mappage déterministe du fichier.
UPDATE "EvidenceItem" SET "rowNature" = 'PRIMARY_OBSERVATION'
 WHERE "rowNature" IS NULL
   AND "provenanceType"::text = 'FIRST_PARTY_CAPTURE';              -- attendu : 2

-- 2. Tout le reste est explicitement NON CLASSÉ. `UNCLASSIFIED` est une
--    déclaration d'ignorance, pas un classement par défaut : une pièce qui le
--    porte est exclue des sorties publiques par la frontière S2.
UPDATE "EvidenceItem" SET "rowNature" = 'UNCLASSIFIED'
 WHERE "rowNature" IS NULL;                                          -- attendu : 1 102

-- ─── VÉRIFICATION — le croisement qui pilotera le classement humain ───────
SELECT COALESCE("provenanceType"::text,'(NULL)') AS provenance,
       COALESCE("sourceType"::text,'(NULL)')     AS source,
       COALESCE("rowNature"::text,'(NULL)')      AS nature,
       count(*)::int AS n
  FROM "EvidenceItem"
 GROUP BY 1,2,3 ORDER BY 4 DESC;

-- ATTENDU : PRIMARY_OBSERVATION 2 · UNCLASSIFIED 1 102 · aucun NULL.
-- Le reste du tableau est la FILE DE TRAVAIL du classement humain : chaque
-- couple (provenance, source) est un lot à trancher, du plus gros au plus petit.

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- ALTER TABLE "EvidenceItem" DROP COLUMN IF EXISTS "rowNature";
