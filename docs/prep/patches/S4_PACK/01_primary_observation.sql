-- ═══════════════════════════════════════════════════════════════════════════
-- S4 · FICHIER 1/6 — PRIMARY_OBSERVATION · 1 050 lignes
--
-- R1 RATIFIÉ : la nature qualifie l'ACTE dont la ligne est le produit, pas la
-- vérité de ce que la pièce montre. Une capture d'écran est le produit d'un
-- acte d'observation : elle atteste que CET ÉCRAN A AFFICHÉ CELA. Elle
-- n'atteste ni l'authenticité du post, ni la véracité de son contenu.
--
-- R2 RATIFIÉ : la nature n'est PAS la confiance. Les 164 lignes du pivot ont
-- une confiance temporelle FAIBLE ; elles restent des observations primaires.
-- Le marqueur de confiance est posé séparément par le fichier 04 — jamais en
-- dégradant la nature. Reclasser une capture mal datée en THIRD_PARTY_DATA
-- serait mélanger les deux axes : INTERDIT.
--
-- Tous les prédicats ci-dessous ont été remesurés en lecture seule le
-- 2026-08-28 sur ep-square-band. Somme des 7 lots = 1 050, contrôlée.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── LOT 1 — captures de PAGES DE RECHERCHE X ─────────────────────────────
-- 753 lignes. Ratifié : PRIMARY_OBSERVATION de ce que la page a montré à ce
-- compte à cet instant. NE PAS reclasser.
--
-- ⚠️ INTERDIT, et cet interdit ne se code pas ici : citer une capture de page
-- de recherche personnalisée comme équivalente à la preuve canonique d'un
-- tweet. Une page de recherche X est classée et personnalisée — deux comptes
-- n'obtiennent pas le même écran. La recapture par permalien des pièces
-- importantes est un CHANTIER SÉPARÉ (backlog), pas une condition de ce pack.
UPDATE "EvidenceItem" SET "rowNature" = 'PRIMARY_OBSERVATION'
 WHERE "rowNature" = 'UNCLASSIFIED'
   AND "captureTool" = 'migrate-snapshots'
   AND "sourceUrl" ILIKE '%/search?%';                              -- attendu : 753

-- ─── LOT 2 — captures de PROFILS X nus ────────────────────────────────────
-- 133 lignes. Ancrage source présent (URL de profil), acte d'observation clair.
UPDATE "EvidenceItem" SET "rowNature" = 'PRIMARY_OBSERVATION'
 WHERE "rowNature" = 'UNCLASSIFIED'
   AND "captureTool" = 'migrate-snapshots'
   AND "sourceUrl" IS NOT NULL
   AND "sourceUrl" NOT ILIKE '%/search?%';                          -- attendu : 133

-- ─── LOT 3 — captures migrées SANS sourceUrl ──────────────────────────────
-- 39 lignes. PIVOT. L'ancrage source manque ; l'acte reste une observation.
UPDATE "EvidenceItem" SET "rowNature" = 'PRIMARY_OBSERVATION'
 WHERE "rowNature" = 'UNCLASSIFIED'
   AND "captureTool" = 'migrate-snapshots'
   AND "sourceUrl" IS NULL;                                         -- attendu : 39

-- ─── LOT 4 — captures PNG de backfill, étiquetées X_POST ──────────────────
-- 60 lignes. PIVOT. Archives « CAPTURE (X) » 40, « BK DIONE » 17, hors archive 3.
UPDATE "EvidenceItem" SET "rowNature" = 'PRIMARY_OBSERVATION'
 WHERE "rowNature" = 'UNCLASSIFIED'
   AND "captureTool" = 'backfill'
   AND "sourceType" = 'X_POST'
   AND "mimeType" = 'image/png';                                    -- attendu : 60

-- ─── LOT 5 — captures PNG de backfill, étiquetées OTHER ───────────────────
-- 51 lignes. PIVOT. Le sourceType est FAUX : ce lot contient 19 captures du
-- profil X de Gordon, 9 de @planted, 5 d'un site web. Le sourceType est faux,
-- l'ACTE est identique — et c'est l'acte qui décide (R1).
UPDATE "EvidenceItem" SET "rowNature" = 'PRIMARY_OBSERVATION'
 WHERE "rowNature" = 'UNCLASSIFIED'
   AND "captureTool" = 'backfill'
   AND "sourceType" = 'OTHER'
   AND "mimeType" = 'image/png';                                    -- attendu : 51

-- ─── LOT 6 — captures PNG de pages d'EXPLORATEUR ──────────────────────────
-- 10 lignes. PIVOT. La page montre de la donnée tierce ; la capture reste
-- l'observation de l'écran (R1). La nature du contenu affiché NE REMONTE PAS
-- à la pièce.
UPDATE "EvidenceItem" SET "rowNature" = 'PRIMARY_OBSERVATION'
 WHERE "rowNature" = 'UNCLASSIFIED'
   AND "captureTool" = 'backfill'
   AND "sourceType" = 'EXPLORER'
   AND "mimeType" = 'image/png';                                    -- attendu : 10

-- ─── LOT 7 — captures .webp au mimeType mal deviné ────────────────────────
-- 4 lignes. PIVOT. Rangées en application/octet-stream par le backfill, ce
-- sont des captures d'écran. Le mimeType est un défaut d'ingestion, pas une
-- question de nature — il n'est PAS corrigé ici (ce serait hors périmètre).
UPDATE "EvidenceItem" SET "rowNature" = 'PRIMARY_OBSERVATION'
 WHERE "rowNature" = 'UNCLASSIFIED'
   AND "captureTool" = 'backfill'
   AND "mimeType" = 'application/octet-stream'
   AND "filePath" ILIKE '%.webp';                                   -- attendu : 4

-- ─── VÉRIFICATION ─────────────────────────────────────────────────────────
SELECT COALESCE("rowNature"::text,'(NULL)') AS nature, count(*)::int AS n
  FROM "EvidenceItem" GROUP BY 1 ORDER BY 2 DESC;
-- ATTENDU APRÈS CE SEUL FICHIER :
--   PRIMARY_OBSERVATION 1 052  (1 050 + les 2 déjà classées en S3)
--   UNCLASSIFIED           52
-- Toute autre répartition = ARRÊT. La donnée a bougé depuis la mesure.

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- Ne remet PAS à UNCLASSIFIED les 2 lignes classées par S3 : elles portent
-- provenanceType='FIRST_PARTY_CAPTURE', que ce fichier n'a jamais touchées.
-- UPDATE "EvidenceItem" SET "rowNature" = 'UNCLASSIFIED'
--  WHERE "rowNature" = 'PRIMARY_OBSERVATION'
--    AND "provenanceType" IS DISTINCT FROM 'FIRST_PARTY_CAPTURE';
