-- MIGRATION_proceeds_containment_v1.sql
-- Chantier: P0 — CONTAINMENT DES PROCEEDS
-- Target DB: Neon ep-square-band UNIQUEMENT.
--
-- STATUS: NON APPLIQUÉE. Générée pour exécution manuelle par David dans le
-- Neon SQL Editor. Claude Code n'applique jamais de migration, ne lance jamais
-- prisma db push, et n'exécute aucun UPDATE manuel sur ep-square-band.
--
-- ⚠️ ORDRE DE DÉPLOIEMENT IMPÉRATIF
--    1. Exécuter CETTE migration dans le Neon SQL Editor.
--    2. `pnpm prisma:generate`.
--    3. Déployer (`npx vercel --prod`).
--    4. Exécuter RETRAIT_proceeds_2026-08-16.sql (les 6 décisions de retrait).
--    Le code déployé sélectionne "proceedsPublication" : déployer AVANT la
--    migration ferait échouer toute lecture de profil KOL. L'inverse est sûr —
--    la colonne existe avec DEFAULT 'published', le code d'avant l'ignore.
--
-- ADDITIF UNIQUEMENT. Une CREATE TABLE, trois index, une ADD COLUMN avec
-- DEFAULT. Aucun DROP, aucun ALTER de colonne existante, aucune suppression de
-- donnée, aucun backfill de valeur métier. Ré-exécutable (IF NOT EXISTS).
--
-- ─── POURQUOI UNE TABLE DÉDIÉE, ET PAS KolTokenLinkStatusLog ──────────────
--
-- Le journal livré au P0-2 est keyé sur "linkId" — un KolTokenLink, c'est-à-dire
-- une association personne ↔ token. Ses colonnes d'état sont fromVisibility /
-- toVisibility. Aucune ne peut exprimer « le montant publié pour ce handle est
-- retiré », ni porter la valeur retirée.
--
-- Les proceeds vivent dans quatre emplacements sans rapport avec KolTokenLink :
--   KolProfile.totalDocumented            le chiffre effectivement publié
--   KolProceedsSummary.totalProceedsUsd   le total du dernier scan on-chain
--   KolProceedsEvent                      les événements unitaires
--   KolTokenInvolvement.proceedsUsd       agrégat gelé depuis 2026-04-11
--
-- archiveLinkPublication n'en lit ni n'en écrit aucun. Il faut donc un second
-- registre, keyé sur le HANDLE. Le motif est identique (append-only, reasonCode
-- contraint, actorId, contestationRef) : c'est une transposition, pas une
-- invention.
--
-- ─── POURQUOI ON FIGE LA VALEUR RETIRÉE DANS LE JOURNAL ───────────────────
--
-- "publishedValueUsd" et "primaryEvidenceUsd" recopient, au moment de la
-- décision, le montant publié et la part réellement adossée à une observation
-- on-chain primaire. Sans cette photo, un recalcul ultérieur de
-- KolProfile.totalDocumented rendrait le journal illisible : on saurait qu'un
-- retrait a eu lieu, pas sur quel chiffre. Or computeProceedsForHandle SUPPRIME
-- et réécrit les événements à chaque passage (proceeds.ts:231) — la valeur du
-- jour du retrait est donc structurellement périssable. Elle est figée ici.
--
-- ─── DÉNORMALISATION VOLONTAIRE, AUCUNE FK ────────────────────────────────
--
-- kolHandle est recopié sans FK vers KolProfile. Une FK ON DELETE CASCADE
-- effacerait l'historique du retrait en même temps que le profil — exactement
-- ce qu'une piste de contestation ne doit jamais permettre. Le journal doit
-- survivre à la disparition de son objet. C'est un registre, pas une relation.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. LE REGISTRE
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "KolProceedsPublicationLog" (
  "id"                  TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Objet de la décision. Pas de FK : voir « dénormalisation volontaire ».
  "kolHandle"           TEXT         NOT NULL,

  -- Sur quoi porte la décision. Un retrait de 'profile_total' suffit à couvrir
  -- toutes les surfaces publiques ; les trois autres portées existent pour que
  -- le registre reste exact si une décision plus étroite est prise plus tard.
  "scope"               TEXT         NOT NULL,

  -- Transition. Les deux bornes sont enregistrées : « depuis quel état ».
  "fromStatus"          TEXT         NOT NULL,
  "toStatus"            TEXT         NOT NULL,

  -- Photo au moment de la décision. Voir « pourquoi on fige la valeur ».
  "publishedValueUsd"   NUMERIC,
  "primaryEvidenceUsd"  NUMERIC,

  -- Motif. reasonCode est contraint (CHECK) pour rester agrégeable ;
  -- reason est le texte libre obligatoire, non vide.
  "reasonCode"          TEXT         NOT NULL,
  "reason"              TEXT         NOT NULL,

  -- Qui, quand. actorId doit désigner une personne réelle ou un acteur machine
  -- nommé — jamais la chaîne 'admin', qui n'est attribuable à personne.
  "actorId"             TEXT         NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT now(),

  -- Quand le retrait honore une contestation, sa référence. Nullable.
  "contestationRef"     TEXT,

  CONSTRAINT "KolProceedsPublicationLog_reason_not_blank"
    CHECK (length(btrim("reason")) > 0),
  CONSTRAINT "KolProceedsPublicationLog_actorId_not_blank"
    CHECK (length(btrim("actorId")) > 0),
  CONSTRAINT "KolProceedsPublicationLog_actorId_not_admin"
    CHECK (lower(btrim("actorId")) <> 'admin'),
  CONSTRAINT "KolProceedsPublicationLog_scope_allowed"
    CHECK ("scope" IN (
      'profile_total',   -- KolProfile.totalDocumented — la surface publique
      'summary',         -- KolProceedsSummary.totalProceedsUsd
      'event',           -- une ligne KolProceedsEvent
      'involvement'      -- KolTokenInvolvement.proceedsUsd
    )),
  CONSTRAINT "KolProceedsPublicationLog_status_allowed"
    CHECK ("fromStatus" IN ('published','withdrawn')
       AND "toStatus"   IN ('published','withdrawn')),
  CONSTRAINT "KolProceedsPublicationLog_transition_is_real"
    CHECK ("fromStatus" <> "toStatus"),
  -- Aligné sur PUBLICATION_DECISION_CODES (linkPublicationJournal.ts:33-42).
  CONSTRAINT "KolProceedsPublicationLog_reasonCode_allowed"
    CHECK ("reasonCode" IN (
      'approved',             -- remise en publication
      'rejected',
      'contested',            -- contestation reçue et honorée
      'erratum',              -- assertion chiffrée matériellement incorrecte
      'evidence_withdrawn',   -- la preuve qui fondait le chiffre ne tient plus
      'legal',
      'duplicate',
      'other'
    ))
);

-- Historique complet d'un handle, du plus récent au plus ancien.
CREATE INDEX IF NOT EXISTS "KolProceedsPublicationLog_kolHandle_createdAt_idx"
  ON "KolProceedsPublicationLog" ("kolHandle", "createdAt" DESC);

-- Agrégation par motif : combien de retraits pour preuve insuffisante, pour
-- erratum. C'est la matière de la démonstration de contrôle éditorial.
CREATE INDEX IF NOT EXISTS "KolProceedsPublicationLog_reasonCode_idx"
  ON "KolProceedsPublicationLog" ("reasonCode");

-- Retrouver le dossier de contestation.
CREATE INDEX IF NOT EXISTS "KolProceedsPublicationLog_contestationRef_idx"
  ON "KolProceedsPublicationLog" ("contestationRef")
  WHERE "contestationRef" IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════
-- 2. L'ÉTAT COURANT
-- ══════════════════════════════════════════════════════════════════════════
--
-- Une colonne additive. totalDocumented n'est JAMAIS touché : la valeur reste
-- lisible en base, en admin, et par toute réinvestigation. Seule sa PUBLICATION
-- bascule. C'est ce qui rend le retrait réversible sans perte.
--
-- DEFAULT 'published' : les 411 profils existants gardent leur comportement
-- actuel. Seuls les handles explicitement retirés par
-- RETRAIT_proceeds_2026-08-16.sql passeront à 'withdrawn'.

ALTER TABLE "KolProfile"
  ADD COLUMN IF NOT EXISTS "proceedsPublication" TEXT NOT NULL DEFAULT 'published';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'KolProfile_proceedsPublication_allowed'
  ) THEN
    ALTER TABLE "KolProfile"
      ADD CONSTRAINT "KolProfile_proceedsPublication_allowed"
      CHECK ("proceedsPublication" IN ('published','withdrawn'));
  END IF;
END $$;

-- Les surfaces publiques filtrent sur cette colonne à chaque lecture de profil.
CREATE INDEX IF NOT EXISTS "KolProfile_proceedsPublication_idx"
  ON "KolProfile" ("proceedsPublication");

-- ─── VÉRIFICATION POST-EXÉCUTION ──────────────────────────────────────────
--
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'KolProceedsPublicationLog'
--    ORDER BY ordinal_position;
--
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = '"KolProceedsPublicationLog"'::regclass;
--
--   -- Doit rendre 411 lignes 'published', 0 'withdrawn' :
--   SELECT "proceedsPublication", count(*) FROM "KolProfile" GROUP BY 1;
--
--   -- Doit rendre 0 : le registre s'ouvre vide.
--   SELECT count(*) FROM "KolProceedsPublicationLog";
--
-- ─── CE QUE CETTE MIGRATION NE FAIT PAS ───────────────────────────────────
--
--   * Elle ne retire RIEN. Elle ouvre le registre et pose l'interrupteur.
--     Les décisions vivent dans RETRAIT_proceeds_2026-08-16.sql.
--   * Elle ne touche pas à totalDocumented, ni à KolProceedsEvent, ni aux
--     6 lignes SUMMARY_ARKHAM, ni à KolProceedsSummary.
--   * Elle ne supprime aucun PDF, aucun objet R2, aucune archive.
--   * Après exécution, le comportement du produit est INCHANGÉ : toutes les
--     lignes valent 'published'.
