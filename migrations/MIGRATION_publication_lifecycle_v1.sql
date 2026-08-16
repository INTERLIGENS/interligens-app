-- MIGRATION_publication_lifecycle_v1.sql
-- Chantier: P0-2 — RÉVERSIBILITÉ ÉDITORIALE (gouvernance de publication)
-- Target DB: Neon ep-square-band UNIQUEMENT.
--
-- STATUS: NON APPLIQUÉE. Générée pour exécution manuelle par David dans le
-- Neon SQL Editor. Claude Code n'applique jamais de migration, ne lance jamais
-- prisma db push, et n'exécute aucun UPDATE manuel sur ep-square-band.
--
-- ADDITIF UNIQUEMENT. Une CREATE TABLE + 4 index. Aucun DROP, aucun ALTER de
-- colonne existante, aucun backfill, aucune contrainte posée sur une table
-- vivante. Ré-exécutable (IF NOT EXISTS).
--
-- ─── POURQUOI UNE TABLE DÉDIÉE ────────────────────────────────────────────
--
-- KolTokenLink porte déjà reviewedBy / reviewedAt / reviewNote. Ces trois
-- colonnes sont MONO-EMPLACEMENT : la décision suivante écrase la précédente.
-- Un cycle draft → public → archived y laisse UNE trace, la dernière. Or
-- l'objet de ce chantier est exactement l'inverse : « on n'efface pas une
-- décision, on l'archive et on trace pourquoi ». Il faut donc un journal en
-- append-only.
--
-- CandidateStatusLog (Sprint 5) existe déjà mais ne convient pas : il est
-- indexé sur candidateId, c'est-à-dire sur SocialPostCandidate. Constat en
-- base ep-square-band le 2026-08-15 :
--
--     createdByBridge | visibility | n
--     ----------------+------------+-----
--     false           | public     | 185
--     true            | draft      |  92
--     true            | public     |   2
--     true            | rejected   |   1
--
-- 185 des 187 liens PUBLICS n'ont AUCUN SocialPostCandidate — ce sont des
-- liens éditoriaux historiques (seed manuel). Les archiver via
-- CandidateStatusLog écrirait dans le vide. Le journal doit donc être keyé sur
-- le LIEN, pas sur le candidat.
--
-- ─── DÉNORMALISATION VOLONTAIRE ───────────────────────────────────────────
--
-- kolHandle / tokenSymbol / canonicalMint sont recopiés dans le journal. Une
-- FK ON DELETE CASCADE vers KolTokenLink effacerait l'historique en même temps
-- que le lien — exactement ce qu'une piste de contestation ne doit jamais
-- permettre. Le journal doit survivre à la disparition de son objet. Aucune FK
-- n'est donc posée : c'est un registre, pas une relation.

CREATE TABLE IF NOT EXISTS "KolTokenLinkStatusLog" (
  "id"                TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Objet de la décision. Pas de FK : voir « dénormalisation volontaire ».
  "linkId"            TEXT         NOT NULL,
  "kolHandle"         TEXT         NOT NULL,
  "tokenSymbol"       TEXT,
  "canonicalMint"     TEXT,

  -- Transition. Les deux bornes sont enregistrées : « depuis quel état ».
  "fromVisibility"    TEXT         NOT NULL,
  "toVisibility"      TEXT         NOT NULL,
  "fromReviewStatus"  TEXT,
  "toReviewStatus"    TEXT,

  -- Motif. reasonCode est contraint (CHECK) pour rester agrégeable ;
  -- reason est le texte libre obligatoire, non vide.
  "reasonCode"        TEXT         NOT NULL,
  "reason"            TEXT         NOT NULL,

  -- Qui, quand.
  "actorId"           TEXT         NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT now(),

  -- Socle du chantier CONTESTATION (crédibilité n°3) : quand la dépublication
  -- honore une contestation, cette colonne porte sa référence. Nullable —
  -- toutes les dépublications ne viennent pas d'une contestation.
  "contestationRef"   TEXT,

  CONSTRAINT "KolTokenLinkStatusLog_reason_not_blank"
    CHECK (length(btrim("reason")) > 0),
  CONSTRAINT "KolTokenLinkStatusLog_reasonCode_allowed"
    CHECK ("reasonCode" IN (
      -- décisions de mise en ligne
      'approved',             -- draft → public
      'rejected',             -- draft → rejected
      -- motifs de DÉPUBLICATION (public → archived)
      'contested',            -- contestation reçue et honorée
      'erratum',              -- erreur factuelle constatée en interne
      'evidence_withdrawn',   -- la preuve qui fondait le lien ne tient plus
      'legal',                -- demande légale / mise en demeure
      'duplicate',            -- doublon d'un autre lien publié
      'other'                 -- autre — reason libre obligatoire
    ))
);

-- Historique complet d'un lien, du plus récent au plus ancien.
CREATE INDEX IF NOT EXISTS "KolTokenLinkStatusLog_linkId_createdAt_idx"
  ON "KolTokenLinkStatusLog" ("linkId", "createdAt" DESC);

-- « Qu'a-t-on décidé au sujet de cette personne ? » — la question que pose
-- une contestation. Doit être répondable sans scanner la table.
CREATE INDEX IF NOT EXISTS "KolTokenLinkStatusLog_kolHandle_createdAt_idx"
  ON "KolTokenLinkStatusLog" ("kolHandle", "createdAt" DESC);

-- Agrégation par motif : combien de dépublications pour contestation, pour
-- erratum… C'est la matière de la démonstration de contrôle éditorial humain.
CREATE INDEX IF NOT EXISTS "KolTokenLinkStatusLog_reasonCode_idx"
  ON "KolTokenLinkStatusLog" ("reasonCode");

-- Retrouver le dossier de contestation.
CREATE INDEX IF NOT EXISTS "KolTokenLinkStatusLog_contestationRef_idx"
  ON "KolTokenLinkStatusLog" ("contestationRef")
  WHERE "contestationRef" IS NOT NULL;

-- ─── VÉRIFICATION POST-EXÉCUTION (à lancer après le CREATE) ───────────────
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'KolTokenLinkStatusLog'
--    ORDER BY ordinal_position;
--
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = '"KolTokenLinkStatusLog"'::regclass;
--
-- ─── CE QUE CETTE MIGRATION NE FAIT PAS ───────────────────────────────────
--
--   * Elle n'ajoute AUCUNE valeur 'archived' à KolTokenLink.visibility :
--     la colonne est un TEXT libre côté Postgres, la contrainte d'états vit
--     dans le code (ARCHIVABLE_FROM / archiveLinkPublication.ts).
--   * Elle ne touche à AUCUNE ligne existante. Après exécution, le comptage
--     visibility reste public=187 / draft=92 / rejected=1.
--   * Elle ne publie rien et n'archive rien : elle ouvre seulement le registre.
