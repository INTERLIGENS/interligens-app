-- ═══════════════════════════════════════════════════════════════════════════
-- POST-CHECK — evidence_storage_location_journal — SECOND BLOC, LECTURE SEULE
-- Fichier : docs/prep/POSTCHECK_STORAGE_LOCATION_JOURNAL_2026-09-15.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- À coller tel quel dans l'éditeur SQL Neon APRÈS le bloc DDL de
-- docs/prep/MIGRATION_STORAGE_LOCATION_JOURNAL_2026-09-15.sql. Une seule
-- requête, une ligne par point vérifié. Aucune écriture.
--
-- LIRE : la colonne `ok` doit être `true` sur TOUTES les lignes (ORDER BY ok
-- remonte les `false` en tête). Une seule ligne `false` = pose non conforme.
--
-- Attendu : 10 colonnes et leurs types · id GENERATED ALWAYS · AUCUN DEFAULT
-- sur declared_at ni observed_at · 8 contraintes (1 PK + 6 CHECK + 1 FK)
-- chacune comparée à sa pg_get_constraintdef, FK ON UPDATE RESTRICT ON DELETE
-- RESTRICT · index (evidence_item_id, id DESC) · 2 triggers, tgenabled = 'O'
-- · table VIDE.
--
-- Le filtre contype <> 'n' est INDISPENSABLE : PostgreSQL 18 expose les
-- NOT NULL comme contraintes dans pg_constraint, 17.11 (la production) non.
-- La nullabilité est vérifiée par information_schema.columns.
--
-- Les formes RENDUES (= ANY (ARRAY[...]), ::text, parenthèses) sont celles que
-- Postgres 17 restitue, MESURÉES en rejeu PGlite 17.5 par le harnais
-- scripts/evidence-chain/harnais-registre-localisation-pglite.mts — jamais
-- écrites à la main.

WITH attendu_colonnes(ordinal, nom, type_attendu, nullable_attendu, defaut_attendu) AS (VALUES
  (1,  'id',                 'bigint',                   'NO',  NULL),
  (2,  'evidence_item_id',   'text',                     'NO',  NULL),
  (3,  'bucket',             'text',                     'NO',  NULL),
  (4,  'storage_key',        'text',                     'NO',  NULL),
  (5,  'establishment_mode', 'text',                     'NO',  NULL),
  (6,  'declared_by',        'text',                     'NO',  NULL),
  (7,  'declared_at',        'timestamp with time zone', 'NO',  NULL),
  (8,  'observed_by',        'text',                     'YES', NULL),
  (9,  'observed_at',        'timestamp with time zone', 'YES', NULL),
  (10, 'recorded_at',        'timestamp with time zone', 'NO',  'now()')
),
attendu_contraintes(nom, type_attendu, def_attendue) AS (VALUES
  ('evidence_storage_location_journal_pkey',                            'p', 'PRIMARY KEY (id)'),
  ('evidence_storage_location_journal_bucket_check',                    'c', 'CHECK ((bucket ~ ''^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$''::text))'),
  ('evidence_storage_location_journal_storage_key_check',               'c', 'CHECK (((storage_key <> ''''::text) AND (btrim(storage_key) = storage_key) AND (storage_key !~ ''[[:cntrl:]]''::text) AND (storage_key !~ ''^/''::text)))'),
  ('evidence_storage_location_journal_establishment_mode_check',        'c', 'CHECK ((establishment_mode = ANY (ARRAY[''DECLARED_AT_WRITE''::text, ''VERIFIED_BY_HEAD''::text])))'),
  ('evidence_storage_location_journal_declared_by_check',               'c', 'CHECK (((declared_by <> ''''::text) AND (btrim(declared_by) = declared_by)))'),
  ('evidence_storage_location_journal_observed_by_check',               'c', 'CHECK (((observed_by <> ''''::text) AND (btrim(observed_by) = observed_by)))'),
  -- Nom raccourci : la forme longue faisait 64 octets et Postgres l'aurait
  -- tronquée à 63. Mesuré en rejeu PGlite le 2026-09-15.
  ('evidence_storage_location_journal_head_iff_observation_check',  'c', 'CHECK ((((establishment_mode = ''VERIFIED_BY_HEAD''::text) = (observed_by IS NOT NULL)) AND ((establishment_mode = ''VERIFIED_BY_HEAD''::text) = (observed_at IS NOT NULL))))'),
  ('evidence_storage_location_journal_item_fkey',                       'f', 'FOREIGN KEY (evidence_item_id) REFERENCES "EvidenceItem"(id) ON UPDATE RESTRICT ON DELETE RESTRICT')
),
attendu_triggers(nom, def_attendue) AS (VALUES
  ('evidence_storage_location_journal_no_rewrite',  'CREATE TRIGGER evidence_storage_location_journal_no_rewrite BEFORE DELETE OR UPDATE ON public.evidence_storage_location_journal FOR EACH ROW EXECUTE FUNCTION evidence_storage_location_journal_append_only()'),
  ('evidence_storage_location_journal_no_truncate', 'CREATE TRIGGER evidence_storage_location_journal_no_truncate BEFORE TRUNCATE ON public.evidence_storage_location_journal FOR EACH STATEMENT EXECUTE FUNCTION evidence_storage_location_journal_append_only()')
),
reel_colonnes AS (
  SELECT ordinal_position, column_name, data_type, is_nullable, column_default, identity_generation
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'evidence_storage_location_journal'
),
reel_contraintes AS (
  SELECT c.conname, c.contype::text AS contype, regexp_replace(pg_get_constraintdef(c.oid), '\s+', ' ', 'g') AS def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'public' AND t.relname = 'evidence_storage_location_journal' AND c.contype <> 'n'
),
reel_triggers AS (
  SELECT t.tgname, t.tgenabled::text AS tgenabled, pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'evidence_storage_location_journal' AND NOT t.tgisinternal
),
lignes AS (
  SELECT 'colonne ' || a.nom AS point,
         a.type_attendu || ' / ' || a.nullable_attendu || ' / defaut=' || COALESCE(a.defaut_attendu, 'AUCUN') AS attendu,
         COALESCE(r.data_type, 'ABSENTE') || ' / ' || COALESCE(r.is_nullable, '-') || ' / defaut=' || COALESCE(r.column_default, 'AUCUN') AS reel,
         (r.column_name IS NOT NULL AND r.ordinal_position = a.ordinal AND r.data_type = a.type_attendu
          AND r.is_nullable = a.nullable_attendu AND r.column_default IS NOT DISTINCT FROM a.defaut_attendu) AS ok
    FROM attendu_colonnes a LEFT JOIN reel_colonnes r ON r.column_name = a.nom
  UNION ALL
  SELECT 'colonnes : compte', '10', count(*)::text, count(*) = 10 FROM reel_colonnes
  UNION ALL
  SELECT 'id : GENERATED ALWAYS AS IDENTITY', 'ALWAYS', COALESCE(identity_generation, 'AUCUNE'), identity_generation = 'ALWAYS'
    FROM reel_colonnes WHERE column_name = 'id'
  UNION ALL
  -- Les deux horloges DÉCLARÉES n'ont pas de défaut : un défaut fabriquerait
  -- un acte « maintenant » que personne n'a daté, et pour observed_at il
  -- fabriquerait une MESURE que personne n'a faite.
  SELECT 'declared_at : SANS DEFAULT', 'AUCUN', COALESCE(column_default, 'AUCUN'), column_default IS NULL FROM reel_colonnes WHERE column_name = 'declared_at'
  UNION ALL
  SELECT 'observed_at : SANS DEFAULT', 'AUCUN', COALESCE(column_default, 'AUCUN'), column_default IS NULL FROM reel_colonnes WHERE column_name = 'observed_at'
  UNION ALL
  SELECT 'contrainte ' || a.nom, a.type_attendu || ' ' || a.def_attendue, COALESCE(r.contype || ' ' || r.def, 'ABSENTE'),
         (r.conname IS NOT NULL AND r.contype = a.type_attendu AND r.def = a.def_attendue)
    FROM attendu_contraintes a LEFT JOIN reel_contraintes r ON r.conname = a.nom
  UNION ALL
  SELECT 'contrainte INATTENDUE ' || r.conname, 'AUCUNE', r.contype || ' ' || r.def, false
    FROM reel_contraintes r WHERE r.conname NOT IN (SELECT nom FROM attendu_contraintes)
  UNION ALL
  SELECT 'contraintes : compte (PK + CHECK + FK, contype <> n)', '8 (1 p + 6 c + 1 f)',
         count(*)::text || ' (' || count(*) FILTER (WHERE contype = 'p') || ' p + ' || count(*) FILTER (WHERE contype = 'c') || ' c + ' || count(*) FILTER (WHERE contype = 'f') || ' f)',
         count(*) = 8 AND count(*) FILTER (WHERE contype = 'p') = 1 AND count(*) FILTER (WHERE contype = 'c') = 6 AND count(*) FILTER (WHERE contype = 'f') = 1
    FROM reel_contraintes
  UNION ALL
  SELECT 'index evidence_storage_location_journal_item_idx', '(evidence_item_id, id DESC)', COALESCE(indexdef, 'ABSENT'),
         indexdef LIKE '%USING btree (evidence_item_id, id DESC)'
    FROM (SELECT (SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'evidence_storage_location_journal' AND indexname = 'evidence_storage_location_journal_item_idx') AS indexdef) x
  UNION ALL
  SELECT 'index : compte', '2 (pkey + item_idx)', count(*)::text, count(*) = 2
    FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'evidence_storage_location_journal'
  UNION ALL
  SELECT 'trigger ' || a.nom, 'tgenabled=O · ' || a.def_attendue, COALESCE('tgenabled=' || r.tgenabled || ' · ' || r.def, 'ABSENT'),
         (r.tgname IS NOT NULL AND r.tgenabled = 'O' AND r.def = a.def_attendue)
    FROM attendu_triggers a LEFT JOIN reel_triggers r ON r.tgname = a.nom
  UNION ALL
  SELECT 'triggers : compte', '2', count(*)::text, count(*) = 2 FROM reel_triggers
  UNION ALL
  -- ⛔ LA TABLE NAÎT VIDE. Aucun backfill, aucune ligne fabriquée depuis un
  -- préfixe de clé. Les 31 lignes VERIFIED_BY_HEAD sont une écriture de
  -- production SÉPARÉE, soumise à l'autorisation du fondateur.
  SELECT 'table VIDE', '0 ligne', count(*)::text || ' ligne(s)', count(*) = 0 FROM evidence_storage_location_journal
)
SELECT point, ok, attendu, reel FROM lignes ORDER BY ok, point;
