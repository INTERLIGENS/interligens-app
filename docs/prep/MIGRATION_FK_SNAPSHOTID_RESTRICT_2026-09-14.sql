-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 3 — FK "CaseFileSource"."snapshotId" → RESTRICT / RESTRICT — DDL
-- Fichier : docs/prep/MIGRATION_FK_SNAPSHOTID_RESTRICT_2026-09-14.sql
-- Fenêtre T1-DDL-PHASE-A-PRET-A-POSER (2026-09-14). Le TROISIÈME DDL de la
-- Phase A, autorisé nommément par GPT comme exception (réponse Q1).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ NON APPLIQUÉ. À coller tel quel dans l'ÉDITEUR SQL NEON (ep-square-band),
--    après snapshot de branche, APRÈS les blocs 1 et 2 (le journal et son
--    post-check). JAMAIS `prisma db push`, JAMAIS `prisma migrate`.
--
-- Principe posé par GPT :
--   « Once an EvidenceSnapshot participates in a CaseFileSource, deletion of
--     that observation must fail rather than degrade the foundation silently. »
-- Aucune suppression de snapshot n'est demandée. UNIQUEMENT la FK.
--
-- ─── ÉTAT RÉEL MESURÉ le 2026-09-14 (pg_constraint, lecture seule) ──────────
--   conname        : CaseFileSource_snapshotId_fkey
--   def            : FOREIGN KEY ("snapshotId") REFERENCES "EvidenceSnapshot"(id)
--                    ON DELETE SET NULL
--   confdeltype    : n  (SET NULL)
--   confupdtype    : a  (NO ACTION — le défaut, que pg_get_constraintdef ne
--                        rend pas ; ce n'est PAS RESTRICT : NO ACTION est
--                        vérifié en fin d'instruction et peut être différé,
--                        RESTRICT est vérifié immédiatement et ne peut pas l'être)
--   condeferrable  : false · convalidated : true
--   lignes         : 10 sources · 2 avec snapshotId · 8 à NULL (hors contrainte)
--   orphelines     : 0 — aucune ligne avec snapshotId non NULL sans
--                    EvidenceSnapshot correspondant. L'ADD CONSTRAINT ne peut
--                    donc pas échouer sur les données existantes.
--   0 trigger sur "CaseFileSource". Aucun modèle Prisma pour cette table : elle
--   n'existe qu'en SQL brut, ce DDL ne désynchronise aucun client.
--
-- ─── CE QUE LE BLOC FAIT ────────────────────────────────────────────────────
--   Une transaction : deux gardes qui LÈVENT si l'état réel n'est pas celui
--   mesuré, puis DROP CONSTRAINT / ADD CONSTRAINT sous le MÊME nom, puis le
--   post-check. Si une garde lève, rien n'est modifié.
--   Garde 1 : la contrainte existante a EXACTEMENT la forme mesurée ci-dessus
--             (on ne remplace pas une contrainte qu'on n'a pas lue).
--   Garde 2 : zéro ligne orpheline (mesurée dans la transaction, pas supposée).
--   Le nom est conservé : c'est la même contrainte, durcie ; rien d'autre ne
--   la référence.
--
-- ─── CE QUE ÇA CHANGE ───────────────────────────────────────────────────────
--   Avant : supprimer un EvidenceSnapshot référencé par une source passe, et
--           "snapshotId" devient NULL en silence — la projection perd son
--           observation, la source redevient UNKNOWN dérivé sans qu'aucune
--           ligne ne l'écrive (Q1 de la fenêtre précédente).
--   Après : la suppression ÉCHOUE (23503). Le renumérotage aussi.
--   Les 8 sources à NULL ne sont pas concernées : une FK ne contraint pas NULL.

BEGIN;

DO $$
DECLARE
  def_reelle TEXT;
  orphelines INTEGER;
BEGIN
  -- Garde 1 : la contrainte à remplacer est bien celle qui a été mesurée.
  SELECT pg_get_constraintdef(c.oid) INTO def_reelle
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'public' AND t.relname = 'CaseFileSource'
     AND c.conname = 'CaseFileSource_snapshotId_fkey' AND c.contype = 'f';
  IF def_reelle IS NULL THEN
    RAISE EXCEPTION 'BLOC 3 refusé : la contrainte CaseFileSource_snapshotId_fkey est ABSENTE — état réel différent de l''état mesuré, ne rien poser.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;
  IF def_reelle = 'FOREIGN KEY ("snapshotId") REFERENCES "EvidenceSnapshot"(id) ON UPDATE RESTRICT ON DELETE RESTRICT' THEN
    RAISE EXCEPTION 'BLOC 3 refusé : la contrainte est DÉJÀ en RESTRICT/RESTRICT — ce bloc a déjà été posé, ne pas le rejouer.'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;
  IF def_reelle <> 'FOREIGN KEY ("snapshotId") REFERENCES "EvidenceSnapshot"(id) ON DELETE SET NULL' THEN
    RAISE EXCEPTION 'BLOC 3 refusé : forme réelle inattendue « % » — état réel différent de l''état mesuré, ne rien poser.', def_reelle
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  -- Garde 2 : zéro ligne orpheline. Mesuré ICI, dans la transaction.
  SELECT count(*) INTO orphelines
    FROM "CaseFileSource" s
   WHERE s."snapshotId" IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "EvidenceSnapshot" e WHERE e.id = s."snapshotId");
  IF orphelines <> 0 THEN
    RAISE EXCEPTION 'BLOC 3 refusé : % source(s) orpheline(s) (snapshotId sans EvidenceSnapshot) — la contrainte RESTRICT ne serait pas posable, et rien ne doit être réécrit pour la rendre posable.', orphelines
      USING ERRCODE = 'foreign_key_violation';
  END IF;
END
$$;

ALTER TABLE "CaseFileSource"
  DROP CONSTRAINT "CaseFileSource_snapshotId_fkey";

ALTER TABLE "CaseFileSource"
  ADD CONSTRAINT "CaseFileSource_snapshotId_fkey"
  FOREIGN KEY ("snapshotId")
  REFERENCES "EvidenceSnapshot" (id)
  ON UPDATE RESTRICT ON DELETE RESTRICT;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- POST-CHECK INTÉGRÉ — lecture seule, une ligne par point, ok = true partout
-- ═══════════════════════════════════════════════════════════════════════════
-- Filtre contype <> 'n' : PostgreSQL 18 expose les NOT NULL dans pg_constraint,
-- 17.11 (la production) non — le compte de contraintes en dépendrait sinon.
WITH reel AS (
  SELECT c.conname, c.contype::text AS contype, c.confupdtype::text AS on_update, c.confdeltype::text AS on_delete,
         c.condeferrable, c.convalidated, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'public' AND t.relname = 'CaseFileSource' AND c.contype <> 'n'
),
lignes AS (
  SELECT 'FK snapshotId : définition rendue' AS point,
         'FOREIGN KEY ("snapshotId") REFERENCES "EvidenceSnapshot"(id) ON UPDATE RESTRICT ON DELETE RESTRICT' AS attendu,
         COALESCE(def, 'ABSENTE') AS reel,
         def = 'FOREIGN KEY ("snapshotId") REFERENCES "EvidenceSnapshot"(id) ON UPDATE RESTRICT ON DELETE RESTRICT' AS ok
    FROM (SELECT (SELECT def FROM reel WHERE conname = 'CaseFileSource_snapshotId_fkey') AS def) x
  UNION ALL
  SELECT 'FK snapshotId : confdeltype', 'r (RESTRICT)', COALESCE(on_delete, 'ABSENTE'), on_delete = 'r'
    FROM (SELECT (SELECT on_delete FROM reel WHERE conname = 'CaseFileSource_snapshotId_fkey') AS on_delete) x
  UNION ALL
  SELECT 'FK snapshotId : confupdtype', 'r (RESTRICT)', COALESCE(on_update, 'ABSENTE'), on_update = 'r'
    FROM (SELECT (SELECT on_update FROM reel WHERE conname = 'CaseFileSource_snapshotId_fkey') AS on_update) x
  UNION ALL
  SELECT 'FK snapshotId : validée, non différable', 'convalidated=true · condeferrable=false',
         COALESCE('convalidated=' || convalidated || ' · condeferrable=' || condeferrable, 'ABSENTE'),
         convalidated AND NOT condeferrable
    FROM (SELECT (SELECT convalidated FROM reel WHERE conname = 'CaseFileSource_snapshotId_fkey') AS convalidated,
                 (SELECT condeferrable FROM reel WHERE conname = 'CaseFileSource_snapshotId_fkey') AS condeferrable) x
  UNION ALL
  SELECT 'FK casefileRef : INCHANGÉE', 'FOREIGN KEY ("casefileRef") REFERENCES token_casefiles(ref) ON DELETE RESTRICT', COALESCE(def, 'ABSENTE'),
         def = 'FOREIGN KEY ("casefileRef") REFERENCES token_casefiles(ref) ON DELETE RESTRICT'
    FROM (SELECT (SELECT def FROM reel WHERE conname = 'CaseFileSource_casefileRef_fkey') AS def) x
  UNION ALL
  SELECT 'contraintes CaseFileSource : compte (contype <> n)', '4 (1 p + 1 u + 2 f)',
         count(*)::text || ' (' || count(*) FILTER (WHERE contype = 'p') || ' p + ' || count(*) FILTER (WHERE contype = 'u') || ' u + ' || count(*) FILTER (WHERE contype = 'f') || ' f)',
         count(*) = 4 AND count(*) FILTER (WHERE contype = 'p') = 1 AND count(*) FILTER (WHERE contype = 'u') = 1 AND count(*) FILTER (WHERE contype = 'f') = 2
    FROM reel
  UNION ALL
  SELECT 'sources : aucune orpheline', '0', count(*)::text, count(*) = 0
    FROM "CaseFileSource" s
   WHERE s."snapshotId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "EvidenceSnapshot" e WHERE e.id = s."snapshotId")
  UNION ALL
  SELECT 'sources : répartition snapshotId (information, pas un écart)', '2 avec · 8 sans (mesuré 2026-09-14)',
         count(*) FILTER (WHERE "snapshotId" IS NOT NULL)::text || ' avec · ' || count(*) FILTER (WHERE "snapshotId" IS NULL)::text || ' sans', true
    FROM "CaseFileSource"
)
SELECT point, ok, attendu, reel FROM lignes ORDER BY ok, point;
