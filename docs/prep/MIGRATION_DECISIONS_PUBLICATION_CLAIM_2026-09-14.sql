-- ═══════════════════════════════════════════════════════════════════════════
-- SPINE-00 · A — LA TABLE D'AUTORITÉ DE PUBLICATION — DDL ADDITIF
-- Fichier : docs/prep/MIGRATION_DECISIONS_PUBLICATION_CLAIM_2026-09-14.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ NON APPLIQUÉ. À coller dans l'ÉDITEUR SQL NEON (ep-square-band), après
--    snapshot de branche. JAMAIS `prisma db push`, JAMAIS `prisma migrate` —
--    les deux schemas portent le verrou A9 et s'arrêtent sur P1012.
--
-- Ruling GPT du 13/09 :
--   « Le contenu et l'autorité de le publier sont deux objets différents. »
--   « Publication state is a projection of a persisted publication decision;
--     the state itself is not the authority. »
--   ⛔ PAS de decidedBy / decidedAt sur CaseFileClaim.
--
-- ADDITIF ET SEULEMENT ADDITIF : aucune table existante n'est touchée. La
-- table CaseFileClaim n'est que RÉFÉRENCÉE.
--
-- ─── PRÉREQUIS MESURÉS le 2026-09-14 (information_schema / pg_catalog) ───────
--   · table cible : public."CaseFileClaim" — camelCase, guillemets obligatoires
--   · "casefileRef" text NOT NULL · "claimId" text NOT NULL · version integer NOT NULL
--   · UNIQUE "CaseFileClaim_ref_claimid_version_key" ("casefileRef","claimId",version)
--     → une FK composite peut viser une VERSION PRÉCISE. Elle porte TROIS colonnes,
--       pas deux : "claimId" seul n'est unique dans aucune contrainte (C1 est un
--       identifiant local au dossier). C'est pourquoi casefile_ref est ici.
--   · PostgreSQL 17.11 · rôle neondb_owner, CREATE sur public : oui
--   · 0 trigger sur CaseFileClaim, 0 fonction append-only dans la base
--
-- ─── CE QUE LA TABLE GARANTIT PAR STRUCTURE ─────────────────────────────────
--   1. un GRANT ne peut PAS viser une version inexistante  → FK composite
--   2. les domaines sont FERMÉS                            → CHECK énumérés
--   3. la décision la plus récente est NON AMBIGUË         → id IDENTITY, ordre total
--   4. on n'écrase jamais une décision                     → trigger (DDL SUPPLÉMENTAIRE,
--                                                             voir section marquée)
--
-- ─── COLONNES : le minimum de GPT + trois justifiées ────────────────────────
--   GPT      : claim_id · claim_version · audience · decision · decided_by · decided_at
--   ajoutées : casefile_ref  — exigée par la FK (l'unique cible a trois colonnes)
--              id            — clé primaire ET ordre total des décisions ; c'est
--                              par lui que « la dernière décision » se lit
--              recorded_at   — l'horloge de la BASE. decided_at est l'instant
--                              DÉCLARÉ par l'autorité (fourni par l'appelant,
--                              donc contrôlable) ; il ne peut pas servir à
--                              ordonner. Même règle que governed_objects :
--                              une seule horloge pour l'ordre des faits.

BEGIN;

CREATE TABLE IF NOT EXISTS casefile_claim_publication_decisions (
  -- L'ORDRE des décisions. IDENTITY : monotone, jamais réutilisé, jamais fourni
  -- par l'appelant (GENERATED ALWAYS refuse une valeur explicite). « La dernière
  -- décision » = max(id) pour une cible donnée. Un REVOKE postérieur a un id
  -- supérieur au GRANT qu'il l'emporte sur — sans le toucher.
  -- Les TROUS sont normaux : un INSERT refusé (FK, CHECK) consomme sa valeur.
  -- Seul l'ORDRE compte, jamais la densité.
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- ── La CIBLE : une version EXACTE d'un claim d'un dossier.
  casefile_ref   TEXT    NOT NULL,
  claim_id       TEXT    NOT NULL,
  claim_version  INTEGER NOT NULL,

  -- ── Domaines FERMÉS. Fermé à PUBLIC pour le RC : élargir est un DDL délibéré.
  audience       TEXT    NOT NULL CHECK (audience IN ('PUBLIC')),
  decision       TEXT    NOT NULL CHECK (decision IN ('GRANT', 'REVOKE')),

  -- ── L'AUTORITÉ EXPLICITE. Qui, et quand SELON ELLE.
  -- decided_by : non vide, sans blanc de bord — la même règle que
  -- governedWriter.estCleAcceptable, en seconde barrière.
  decided_by     TEXT        NOT NULL CHECK (decided_by <> '' AND btrim(decided_by) = decided_by),
  -- decided_at : PAS de DEFAULT, à dessein. L'instant de la décision est déclaré
  -- par l'autorité ; un défaut fabriquerait une décision « maintenant » que
  -- personne n'a datée.
  decided_at     TIMESTAMPTZ NOT NULL,

  -- ── L'horloge de la base : quand la ligne a été ÉCRITE.
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── LA CONTRAINTE : aucune décision ne vise une version qui n'existe pas.
  -- RESTRICT des deux côtés : une version qui porte une décision ne se
  -- supprime pas et ne se renumérote pas — l'historique de l'autorité tient à
  -- l'historique du contenu.
  CONSTRAINT casefile_claim_publication_decisions_target_fkey
    FOREIGN KEY (casefile_ref, claim_id, claim_version)
    REFERENCES "CaseFileClaim" ("casefileRef", "claimId", version)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

-- La RELECTURE par l'exécuteur : « la dernière décision pour cette cible ».
-- Égalité sur les quatre colonnes de cible, puis id décroissant. Le même index
-- sert les vérifications de la FK (préfixe casefile_ref, claim_id, claim_version).
CREATE INDEX IF NOT EXISTS casefile_claim_publication_decisions_target_idx
  ON casefile_claim_publication_decisions (casefile_ref, claim_id, claim_version, audience, id DESC);

COMMENT ON TABLE casefile_claim_publication_decisions IS
  'SPINE-00 A. Journal APPEND-ONLY des decisions de publication d''une VERSION de CaseFileClaim. '
  'L''etat public d''un claim est une PROJECTION de la derniere decision (max(id) par cible) ; '
  'l''etat n''est pas l''autorite. GRANT sur v1 n''autorise jamais v2. Un REVOKE posterieur '
  'l''emporte sans effacer le GRANT.';

-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ DDL SUPPLÉMENTAIRE — APPEND-ONLY PAR TRIGGER. HORS DU « MINIMUM » DE GPT.
-- ═══════════════════════════════════════════════════════════════════════════
-- GPT a autorisé la création de la table minimale. Rendre l'append-only
-- EXÉCUTABLE exige une fonction et deux triggers sur CETTE table (pas sur une
-- table existante). C'est nommé ici, pas glissé : sans cette section, l'append-
-- only n'est qu'une DISCIPLINE du code (aucun UPDATE/DELETE écrit), pas une
-- propriété de la base.
--
-- Choix : TRIGGER qui LÈVE, et non RULE ni REVOKE.
--   · une RULE `DO INSTEAD NOTHING` échoue en SILENCE — le contraire de ce qu'on veut ;
--   · un REVOKE UPDATE/DELETE ne tient pas : l'application se connecte en
--     neondb_owner, propriétaire de la table, qui garde ses droits.
-- Ce que le trigger garantit : aucun UPDATE, DELETE ou TRUNCATE ne passe par
-- l'application ni par une requête distraite. Ce qu'il NE garantit PAS : le
-- propriétaire peut le supprimer (DROP TRIGGER). C'est une barrière contre le
-- code et l'erreur, pas contre l'autorité de la base — dit franchement.

CREATE OR REPLACE FUNCTION casefile_claim_publication_decisions_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'casefile_claim_publication_decisions est APPEND-ONLY : % refusé. Une décision ne se corrige pas, elle est suivie d''une nouvelle décision.',
    TG_OP
    USING ERRCODE = 'restrict_violation';
END
$$;

CREATE OR REPLACE TRIGGER casefile_claim_publication_decisions_no_rewrite
  BEFORE UPDATE OR DELETE ON casefile_claim_publication_decisions
  FOR EACH ROW EXECUTE FUNCTION casefile_claim_publication_decisions_append_only();

-- TRUNCATE ne passe pas par les triggers de ligne.
CREATE OR REPLACE TRIGGER casefile_claim_publication_decisions_no_truncate
  BEFORE TRUNCATE ON casefile_claim_publication_decisions
  FOR EACH STATEMENT EXECUTE FUNCTION casefile_claim_publication_decisions_append_only();

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS POSE — à exécuter, et à LIRE
-- ═══════════════════════════════════════════════════════════════════════════
-- Un message de commit sur l'état de la base n'est pas une source de vérité.
-- Le vérificateur du dépôt fait la comparaison colonne par colonne :
--
--   npx tsx scripts/casefile/verifier-decisions-publication-schema.ts
--   → 0 conforme · 2 table absente · 3 écarts nommés
--
-- À la main, si besoin :
--
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'casefile_claim_publication_decisions'
--    ORDER BY ordinal_position;
--
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'casefile_claim_publication_decisions'::regclass;
--
--   SELECT tgname FROM pg_trigger
--    WHERE tgrelid = 'casefile_claim_publication_decisions'::regclass AND NOT tgisinternal;
--
-- Attendu : 9 colonnes · 1 PK · 3 CHECK · 1 FK · 1 index cible · 2 triggers · 0 ligne.
