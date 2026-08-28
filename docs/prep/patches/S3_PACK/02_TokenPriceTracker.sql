-- ═══════════════════════════════════════════════════════════════════════════
-- S3 · TABLE 2/5 — TokenPriceTracker · régime FIELD · 340 lignes
--
-- M4, le motif que cette table incarne : 338 lignes sur 340 portent un
-- peakPrice CALCULÉ par le produit (stratégie du plus-haut par filigrane),
-- rangé sous le nom d'un provider qui ne l'a jamais publié. Le prix courant
-- vient bien du provider ; le pic et la chute sont des inférences maison.
-- La colonne `source` ne distingue pas les deux — c'est tout le défaut.
--
--     currentPrice → THIRD_PARTY_DATA
--     peakPrice    → INFERENCE
--     dumpPct      → INFERENCE
--     rowDefault   → THIRD_PARTY_DATA
--
-- Mesuré le 2026-08-28 : currentPrice 338 · peakPrice 338 · dumpPct 338
-- renseignés sur 340 lignes.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "TokenPriceTracker" ADD COLUMN IF NOT EXISTS "currentPriceNature" "DataNature";
ALTER TABLE "TokenPriceTracker" ADD COLUMN IF NOT EXISTS "peakPriceNature"    "DataNature";
ALTER TABLE "TokenPriceTracker" ADD COLUMN IF NOT EXISTS "dumpPctNature"      "DataNature";
ALTER TABLE "TokenPriceTracker" ADD COLUMN IF NOT EXISTS "rowNature"          "DataNature";

UPDATE "TokenPriceTracker" SET "currentPriceNature" = 'THIRD_PARTY_DATA'
 WHERE "currentPriceNature" IS NULL AND "currentPrice" IS NOT NULL;   -- attendu : 338
UPDATE "TokenPriceTracker" SET "peakPriceNature" = 'INFERENCE'
 WHERE "peakPriceNature" IS NULL AND "peakPrice" IS NOT NULL;         -- attendu : 338
UPDATE "TokenPriceTracker" SET "dumpPctNature" = 'INFERENCE'
 WHERE "dumpPctNature" IS NULL AND "dumpPct" IS NOT NULL;             -- attendu : 338
UPDATE "TokenPriceTracker" SET "rowNature" = 'THIRD_PARTY_DATA'
 WHERE "rowNature" IS NULL;                                           -- attendu : 340

-- ─── VÉRIFICATION ─────────────────────────────────────────────────────────
SELECT 'currentPrice' AS champ, COALESCE("currentPriceNature"::text,'(NULL)') AS nature, count(*)::int
  FROM "TokenPriceTracker" GROUP BY 2
UNION ALL SELECT 'peakPrice', COALESCE("peakPriceNature"::text,'(NULL)'), count(*)::int
  FROM "TokenPriceTracker" GROUP BY 2
UNION ALL SELECT 'dumpPct', COALESCE("dumpPctNature"::text,'(NULL)'), count(*)::int
  FROM "TokenPriceTracker" GROUP BY 2
UNION ALL SELECT 'row', COALESCE("rowNature"::text,'(NULL)'), count(*)::int
  FROM "TokenPriceTracker" GROUP BY 2
 ORDER BY 1, 2;

-- ATTENDU : currentPrice THIRD_PARTY_DATA 338 + (NULL) 2
--           peakPrice / dumpPct INFERENCE 338 + (NULL) 2
--           row THIRD_PARTY_DATA 340

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- ALTER TABLE "TokenPriceTracker" DROP COLUMN IF EXISTS "currentPriceNature";
-- ALTER TABLE "TokenPriceTracker" DROP COLUMN IF EXISTS "peakPriceNature";
-- ALTER TABLE "TokenPriceTracker" DROP COLUMN IF EXISTS "dumpPctNature";
-- ALTER TABLE "TokenPriceTracker" DROP COLUMN IF EXISTS "rowNature";
