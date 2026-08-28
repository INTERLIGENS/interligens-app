-- ═══════════════════════════════════════════════════════════════════════════
-- S3 · TABLE 5/5 — KolTokenInvolvement · régime ROW · 15 lignes
--
-- retailLossEstimateUsd est une ESTIMATE par construction. Mesuré le
-- 2026-08-28 : **0 ligne sur 15 ne le renseigne**. La colonne de nature est
-- donc posée AVANT que la donnée n'existe — c'est le bon ordre, et le seul
-- endroit du plan où on l'obtient gratuitement : la première estimation écrite
-- naîtra dans un schéma qui sait déjà ce qu'elle est.
--
-- Aucune ligne n'est classable aujourd'hui : les 15 restent UNCLASSIFIED.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "KolTokenInvolvement" ADD COLUMN IF NOT EXISTS "retailLossEstimateUsdNature" "DataNature";
ALTER TABLE "KolTokenInvolvement" ADD COLUMN IF NOT EXISTS "rowNature" "DataNature";

-- Si une estimation a été écrite entre la mesure et l'exécution, elle est
-- classée pour ce qu'elle est. Sinon ce UPDATE ne touche rien.
UPDATE "KolTokenInvolvement" SET "retailLossEstimateUsdNature" = 'ESTIMATE'
 WHERE "retailLossEstimateUsdNature" IS NULL
   AND "retailLossEstimateUsd" IS NOT NULL;                     -- attendu : 0

UPDATE "KolTokenInvolvement" SET "rowNature" = 'UNCLASSIFIED'
 WHERE "rowNature" IS NULL;                                     -- attendu : 15

-- ─── VÉRIFICATION ─────────────────────────────────────────────────────────
SELECT COALESCE("retailLossEstimateUsdNature"::text,'(NULL)') AS estimate_nature,
       COALESCE("rowNature"::text,'(NULL)')                    AS row_nature,
       count(*)::int AS n
  FROM "KolTokenInvolvement" GROUP BY 1,2;

-- ATTENDU : ((NULL), UNCLASSIFIED) = 15
-- Si estimate_nature = ESTIMATE apparaît, une estimation a été écrite depuis
-- la mesure : elle exigera un methodRef en S5.

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- ALTER TABLE "KolTokenInvolvement" DROP COLUMN IF EXISTS "retailLossEstimateUsdNature";
-- ALTER TABLE "KolTokenInvolvement" DROP COLUMN IF EXISTS "rowNature";
