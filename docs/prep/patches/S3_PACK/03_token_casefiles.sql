-- ═══════════════════════════════════════════════════════════════════════════
-- S3 · TABLE 3/5 — token_casefiles · régime FIELD
--
-- M3, le motif le plus dangereux du lot : 482 M$ ESTIMÉS voisinent 1,5 M$
-- REVENDIQUÉS, dans deux colonnes du même type numérique. Rien, aujourd'hui,
-- ne dit au lecteur que l'un est un chiffre repris d'un tiers et l'autre le
-- produit d'une méthode maison.
--
--     claimedRaiseUsd        → THIRD_PARTY_DATA   (repris d'une annonce)
--     estimatedRetailHarmUsd → ESTIMATE           (exigera un methodRef en S5)
--     rowDefault             → EDITORIAL_ASSERTION
--
-- ⚠️ ÉCART DE COMPTAGE. Le registre annonce 1 ligne ; la base en porte 2
-- (mesuré 2026-08-28). Un écart de 100 %. Voir README §Questions ouvertes —
-- à trancher AVANT d'exécuter ce fichier.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "token_casefiles" ADD COLUMN IF NOT EXISTS "claimedRaiseUsdNature"        "DataNature";
ALTER TABLE "token_casefiles" ADD COLUMN IF NOT EXISTS "estimatedRetailHarmUsdNature" "DataNature";
ALTER TABLE "token_casefiles" ADD COLUMN IF NOT EXISTS "rowNature"                    "DataNature";

UPDATE "token_casefiles" SET "claimedRaiseUsdNature" = 'THIRD_PARTY_DATA'
 WHERE "claimedRaiseUsdNature" IS NULL AND "claimedRaiseUsd" IS NOT NULL;
UPDATE "token_casefiles" SET "estimatedRetailHarmUsdNature" = 'ESTIMATE'
 WHERE "estimatedRetailHarmUsdNature" IS NULL AND "estimatedRetailHarmUsd" IS NOT NULL;
UPDATE "token_casefiles" SET "rowNature" = 'EDITORIAL_ASSERTION'
 WHERE "rowNature" IS NULL;

-- ─── VÉRIFICATION — ligne à ligne, la table est minuscule ─────────────────
SELECT "ref", "ticker",
       "claimedRaiseUsd", "claimedRaiseUsdNature",
       "estimatedRetailHarmUsd", "estimatedRetailHarmUsdNature",
       "rowNature"
  FROM "token_casefiles" ORDER BY "ref";

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- ALTER TABLE "token_casefiles" DROP COLUMN IF EXISTS "claimedRaiseUsdNature";
-- ALTER TABLE "token_casefiles" DROP COLUMN IF EXISTS "estimatedRetailHarmUsdNature";
-- ALTER TABLE "token_casefiles" DROP COLUMN IF EXISTS "rowNature";
