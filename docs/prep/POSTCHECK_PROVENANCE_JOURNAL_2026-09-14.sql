-- ═══════════════════════════════════════════════════════════════════════════
-- POST-CHECK — evidence_provenance_journal — SECOND BLOC, LECTURE SEULE
-- Fichier : docs/prep/POSTCHECK_PROVENANCE_JOURNAL_2026-09-14.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- À coller tel quel dans l'éditeur SQL Neon APRÈS le bloc DDL de
-- docs/prep/MIGRATION_PROVENANCE_JOURNAL_2026-09-14.sql. Une seule requête,
-- une ligne par point vérifié. Aucune écriture.
--
-- LIRE : la colonne `ok` doit être `true` sur TOUTES les lignes (ORDER BY ok
-- remonte les `false` en tête). Une seule ligne `false` = pose non conforme.
--
-- Attendu : 12 colonnes et leurs types · id GENERATED ALWAYS · AUCUN DEFAULT
-- sur declared_at et verified_at · 11 contraintes (1 PK + 9 CHECK + 1 FK)
-- chacune comparée à sa pg_get_constraintdef, FK ON UPDATE RESTRICT ON DELETE
-- RESTRICT · index (evidence_snapshot_id, id DESC) · 2 triggers, tgenabled = 'O'
-- · table VIDE.
--
-- Le filtre contype <> 'n' est INDISPENSABLE : PostgreSQL 18 expose les
-- NOT NULL comme contraintes dans pg_constraint, 17.11 (la production) non.
-- La nullabilité est vérifiée par information_schema.columns.
--
-- Les formes RENDUES (= ANY (ARRAY[...]), ::text, parenthèses) sont celles que
-- Postgres 17 restitue, mesurées en rejeu PGlite 17.5 par le harnais
-- scripts/casefile/harnais-provenance-journal-pglite.mts.

WITH attendu_colonnes(ordinal, nom, type_attendu, nullable_attendu, defaut_attendu) AS (VALUES
  (1,  'id',                   'bigint',                   'NO',  NULL),
  (2,  'evidence_snapshot_id', 'text',                     'NO',  NULL),
  (3,  'sha256',               'text',                     'YES', NULL),
  (4,  'provenance_kind',      'text',                     'NO',  NULL),
  (5,  'reference_kind',       'text',                     'NO',  NULL),
  (6,  'source_url',           'text',                     'NO',  NULL),
  (7,  'declared_by',          'text',                     'NO',  NULL),
  (8,  'declared_at',          'timestamp with time zone', 'NO',  NULL),
  (9,  'verified_by',          'text',                     'YES', NULL),
  (10, 'verified_at',          'timestamp with time zone', 'YES', NULL),
  (11, 'verification_method',  'text',                     'YES', NULL),
  (12, 'recorded_at',          'timestamp with time zone', 'NO',  'now()')
),
attendu_contraintes(nom, type_attendu, def_attendue) AS (VALUES
  ('evidence_provenance_journal_pkey',                             'p', 'PRIMARY KEY (id)'),
  ('evidence_provenance_journal_sha256_check',                     'c', 'CHECK ((sha256 ~ ''^[0-9a-f]{64}$''::text))'),
  ('evidence_provenance_journal_provenance_kind_check',            'c', 'CHECK ((provenance_kind = ANY (ARRAY[''OPERATOR_DECLARED''::text, ''EXTRACTED''::text, ''VERIFIED''::text])))'),
  ('evidence_provenance_journal_reference_kind_check',             'c', 'CHECK ((reference_kind = ANY (ARRAY[''QUERY_CONTEXT''::text, ''PUBLICATION''::text, ''PROFILE''::text, ''DOCUMENT''::text, ''OTHER''::text])))'),
  ('evidence_provenance_journal_source_url_check',                 'c', 'CHECK (((source_url <> ''''::text) AND (btrim(source_url) = source_url)))'),
  ('evidence_provenance_journal_declared_by_check',                'c', 'CHECK (((declared_by <> ''''::text) AND (btrim(declared_by) = declared_by)))'),
  ('evidence_provenance_journal_verified_by_check',                'c', 'CHECK (((verified_by <> ''''::text) AND (btrim(verified_by) = verified_by)))'),
  ('evidence_provenance_journal_verification_method_check',        'c', 'CHECK ((verification_method = ANY (ARRAY[''URL_MATCHES_CAPTURED_POST''::text, ''ARCHIVE_SNAPSHOT_MATCHES''::text, ''PLATFORM_API_RECORD_MATCHES''::text])))'),
  ('evidence_provenance_journal_verified_iff_verification_check',  'c', 'CHECK ((((provenance_kind = ''VERIFIED''::text) = (verified_by IS NOT NULL)) AND ((provenance_kind = ''VERIFIED''::text) = (verified_at IS NOT NULL)) AND ((provenance_kind = ''VERIFIED''::text) = (verification_method IS NOT NULL))))'),
  ('evidence_provenance_journal_verified_not_query_context_check', 'c', 'CHECK ((NOT ((provenance_kind = ''VERIFIED''::text) AND (reference_kind = ''QUERY_CONTEXT''::text))))'),
  ('evidence_provenance_journal_snapshot_fkey',                    'f', 'FOREIGN KEY (evidence_snapshot_id) REFERENCES "EvidenceSnapshot"(id) ON UPDATE RESTRICT ON DELETE RESTRICT')
),
attendu_triggers(nom, def_attendue) AS (VALUES
  ('evidence_provenance_journal_no_rewrite',  'CREATE TRIGGER evidence_provenance_journal_no_rewrite BEFORE DELETE OR UPDATE ON public.evidence_provenance_journal FOR EACH ROW EXECUTE FUNCTION evidence_provenance_journal_append_only()'),
  ('evidence_provenance_journal_no_truncate', 'CREATE TRIGGER evidence_provenance_journal_no_truncate BEFORE TRUNCATE ON public.evidence_provenance_journal FOR EACH STATEMENT EXECUTE FUNCTION evidence_provenance_journal_append_only()')
),
reel_colonnes AS (
  SELECT ordinal_position, column_name, data_type, is_nullable, column_default, identity_generation
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'evidence_provenance_journal'
),
reel_contraintes AS (
  SELECT c.conname, c.contype::text AS contype, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'public' AND t.relname = 'evidence_provenance_journal' AND c.contype <> 'n'
),
reel_triggers AS (
  SELECT t.tgname, t.tgenabled::text AS tgenabled, pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'evidence_provenance_journal' AND NOT t.tgisinternal
),
lignes AS (
  SELECT 'colonne ' || a.nom AS point,
         a.type_attendu || ' / ' || a.nullable_attendu || ' / defaut=' || COALESCE(a.defaut_attendu, 'AUCUN') AS attendu,
         COALESCE(r.data_type, 'ABSENTE') || ' / ' || COALESCE(r.is_nullable, '-') || ' / defaut=' || COALESCE(r.column_default, 'AUCUN') AS reel,
         (r.column_name IS NOT NULL AND r.ordinal_position = a.ordinal AND r.data_type = a.type_attendu
          AND r.is_nullable = a.nullable_attendu AND r.column_default IS NOT DISTINCT FROM a.defaut_attendu) AS ok
    FROM attendu_colonnes a LEFT JOIN reel_colonnes r ON r.column_name = a.nom
  UNION ALL
  SELECT 'colonnes : compte', '12', count(*)::text, count(*) = 12 FROM reel_colonnes
  UNION ALL
  SELECT 'id : GENERATED ALWAYS AS IDENTITY', 'ALWAYS', COALESCE(identity_generation, 'AUCUNE'), identity_generation = 'ALWAYS'
    FROM reel_colonnes WHERE column_name = 'id'
  UNION ALL
  SELECT 'declared_at : SANS DEFAULT', 'AUCUN', COALESCE(column_default, 'AUCUN'), column_default IS NULL FROM reel_colonnes WHERE column_name = 'declared_at'
  UNION ALL
  SELECT 'verified_at : SANS DEFAULT', 'AUCUN', COALESCE(column_default, 'AUCUN'), column_default IS NULL FROM reel_colonnes WHERE column_name = 'verified_at'
  UNION ALL
  SELECT 'contrainte ' || a.nom, a.type_attendu || ' ' || a.def_attendue, COALESCE(r.contype || ' ' || r.def, 'ABSENTE'),
         (r.conname IS NOT NULL AND r.contype = a.type_attendu AND r.def = a.def_attendue)
    FROM attendu_contraintes a LEFT JOIN reel_contraintes r ON r.conname = a.nom
  UNION ALL
  SELECT 'contrainte INATTENDUE ' || r.conname, 'AUCUNE', r.contype || ' ' || r.def, false
    FROM reel_contraintes r WHERE r.conname NOT IN (SELECT nom FROM attendu_contraintes)
  UNION ALL
  SELECT 'contraintes : compte (PK + CHECK + FK, contype <> n)', '11 (1 p + 9 c + 1 f)',
         count(*)::text || ' (' || count(*) FILTER (WHERE contype = 'p') || ' p + ' || count(*) FILTER (WHERE contype = 'c') || ' c + ' || count(*) FILTER (WHERE contype = 'f') || ' f)',
         count(*) = 11 AND count(*) FILTER (WHERE contype = 'p') = 1 AND count(*) FILTER (WHERE contype = 'c') = 9 AND count(*) FILTER (WHERE contype = 'f') = 1
    FROM reel_contraintes
  UNION ALL
  SELECT 'index evidence_provenance_journal_snapshot_idx', '(evidence_snapshot_id, id DESC)', COALESCE(indexdef, 'ABSENT'),
         indexdef LIKE '%USING btree (evidence_snapshot_id, id DESC)'
    FROM (SELECT (SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'evidence_provenance_journal' AND indexname = 'evidence_provenance_journal_snapshot_idx') AS indexdef) x
  UNION ALL
  SELECT 'index : compte', '2 (pkey + snapshot_idx)', count(*)::text, count(*) = 2
    FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'evidence_provenance_journal'
  UNION ALL
  SELECT 'trigger ' || a.nom, 'tgenabled=O · ' || a.def_attendue, COALESCE('tgenabled=' || r.tgenabled || ' · ' || r.def, 'ABSENT'),
         (r.tgname IS NOT NULL AND r.tgenabled = 'O' AND r.def = a.def_attendue)
    FROM attendu_triggers a LEFT JOIN reel_triggers r ON r.tgname = a.nom
  UNION ALL
  SELECT 'triggers : compte', '2', count(*)::text, count(*) = 2 FROM reel_triggers
  UNION ALL
  SELECT 'table VIDE', '0 ligne', count(*)::text || ' ligne(s)', count(*) = 0 FROM evidence_provenance_journal
)
SELECT point, ok, attendu, reel FROM lignes ORDER BY ok, point;
