-- MIGRATION_laundry_publication_v1.sql
-- Chantier: A12 — CHEMIN DE DÉPUBLICATION DE LaundryTrail
-- Target DB: Neon ep-square-band UNIQUEMENT.
--
-- STATUS: NON APPLIQUÉE, ET NON DÉPLOYÉE. Générée pour exécution manuelle dans
-- le Neon SQL Editor. Claude Code n'applique aucune migration, ne lance jamais
-- prisma migrate ni prisma db push, et n'exécute aucun UPDATE sur
-- ep-square-band.
--
-- EMPLACEMENT : ce fichier appartient à `migrations/MIGRATION_laundry_publication_v1.sql`.
-- Il vit provisoirement sous docs/prep/patches/ parce que `^migrations/` est un
-- chemin gelé par scripts/guard-offline.sh et qu'aucun contournement n'a été
-- fait. À déplacer lors de l'ouverture d'exemption.
--
-- ⚠️ ORDRE DE DÉPLOIEMENT IMPÉRATIF — identique à celui du containment P0 :
--    1. Exécuter CETTE migration dans le Neon SQL Editor.
--    2. `pnpm prisma:generate`.
--    3. Déployer.
--    4. SEULEMENT ENSUITE, écrire des décisions de retrait.
--    Le code qui filtre sélectionne "publication" : déployer AVANT la migration
--    ferait échouer toute lecture de trail. L'inverse est sûr — la colonne
--    existe avec DEFAULT 'published', le code d'avant l'ignore.
--
-- ADDITIF UNIQUEMENT. Une CREATE TABLE, quatre index, une ADD COLUMN avec
-- DEFAULT. Aucun DROP, aucun ALTER de colonne existante, aucune suppression de
-- donnée, aucun backfill de valeur métier. Ré-exécutable (IF NOT EXISTS).
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POURQUOI CETTE MIGRATION EXISTE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `LaundryTrail` est le SEUL objet nominatif publié du dépôt sans état de
-- publication ni journal. Mesuré le 2026-08-18 :
--
--   KolProfile          10 colonnes de statut  +  KolProceedsPublicationLog
--   KolTokenLink         7 colonnes de statut  +  KolTokenLinkStatusLog
--   KolProceedsSummary   3 colonnes de statut
--   LaundryTrail         AUCUNE                   AUCUN journal
--
-- Conséquence en l'état : retirer une de ces phrases exige un DELETE SQL à la
-- main — une destruction, exactement ce que la doctrine du containment
-- interdit. Cette migration remplace la destruction par un interrupteur.
--
-- Ce que ces phrases contiennent, et pourquoi ça n'est pas théorique : les cinq
-- lignes existantes portent chacune un montant chiffré ET une affirmation de
-- mouvement de fonds, en anglais et en français, sur des profils publiés.
-- Détail : docs/prep/RAPPORT_A11_EXPOSITION_LAUNDRYTRAIL.md.
--
-- ─── POURQUOI UN TROISIÈME REGISTRE, ET PAS L'UN DES DEUX EXISTANTS ───────
--
-- KolProceedsPublicationLog est keyé sur "kolHandle" et porte une décision sur
-- un MONTANT AGRÉGÉ ("scope" ∈ profile_total | summary | event | involvement).
-- Un trail n'est pas un agrégat : c'est un TEXTE, il y en a potentiellement
-- plusieurs par handle, et ce qui est retiré est cette phrase-là, pas le total
-- du profil. Enregistrer un retrait de narratif dans ce registre rendrait
-- illisibles les deux : on ne saurait plus si « withdrawn » vise le chiffre ou
-- la phrase.
--
-- KolTokenLinkStatusLog est keyé sur "linkId" (association personne ↔ jeton) et
-- ses bornes d'état sont fromVisibility / toVisibility. Aucun trail n'est un
-- lien de jeton.
--
-- Le motif est identique aux deux — append-only, reasonCode contraint, actorId
-- non attribuable à 'admin', contestationRef. C'est une transposition, pas une
-- invention. Troisième registre, troisième objet.
--
-- ─── CE QU'ON FIGE, ET POURQUOI PAS LE TEXTE ──────────────────────────────
--
-- Le journal des proceeds recopie "publishedValueUsd" parce que
-- computeProceedsForHandle DÉTRUIT et réécrit les événements chaque nuit : la
-- valeur du jour de la décision est structurellement périssable.
--
-- Ici, le texte n'est pas périssable — rien ne le réécrit (une seule écriture
-- dans tout le dépôt, un `create`). On fige donc son EMPREINTE, pas son
-- contenu :
--
--   "narrativeSha256"  identifie sans ambiguïté LA version retirée ;
--   "assertedValueUsd" le montant que la phrase affirme ;
--   "primaryEvidenceUsd" ce que la base soutenait au moment de la décision.
--
-- Recopier le narratif ici DOUBLERAIT l'exposition nominative : deux tables au
-- lieu d'une porteraient la même accusation chiffrée. Une empreinte prouve
-- quelle version a été retirée sans la republier. C'est délibéré.
--
-- ─── DÉNORMALISATION VOLONTAIRE, AUCUNE FK ────────────────────────────────
--
-- "trailId" et "kolHandle" sont recopiés sans FK. Une FK ON DELETE CASCADE
-- effacerait l'historique du retrait en même temps que son objet — exactement
-- ce qu'une piste de contestation ne doit jamais permettre. Le journal doit
-- survivre à la disparition du trail. C'est un registre, pas une relation.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. LE REGISTRE
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "LaundryTrailPublicationLog" (
  "id"                  TEXT         PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Objet de la décision. Pas de FK : voir « dénormalisation volontaire ».
  -- Les DEUX sont enregistrés : trailId identifie la ligne, kolHandle permet
  -- de lire l'historique d'une personne sans jointure sur une table qui peut
  -- avoir disparu.
  "trailId"             TEXT         NOT NULL,
  "kolHandle"           TEXT         NOT NULL,

  -- Sur quoi porte la décision. 'trail_full' retire tout de la ligne ; les deux
  -- portées étroites existent pour qu'une décision partielle reste exprimable
  -- — retirer la phrase en conservant la qualification de risque, ou l'inverse.
  "scope"               TEXT         NOT NULL,

  -- Transition. Les deux bornes : « depuis quel état ».
  "fromStatus"          TEXT         NOT NULL,
  "toStatus"            TEXT         NOT NULL,

  -- Photo au moment de la décision. Voir « ce qu'on fige ».
  -- narrativeSha256 est OBLIGATOIRE : sans lui, on saurait qu'un retrait a eu
  -- lieu, pas sur quelle version du texte.
  "narrativeSha256"     TEXT         NOT NULL,
  "assertedValueUsd"    NUMERIC,
  "primaryEvidenceUsd"  NUMERIC,
  "laundryRiskAtDecision" TEXT,

  -- Motif. reasonCode contraint (CHECK) pour rester agrégeable ;
  -- reason est le texte libre obligatoire, non vide.
  "reasonCode"          TEXT         NOT NULL,
  "reason"              TEXT         NOT NULL,

  -- Qui, quand. actorId doit désigner une personne réelle ou un acteur machine
  -- nommé — jamais 'admin', qui n'est attribuable à personne.
  "actorId"             TEXT         NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT now(),

  -- Quand le retrait honore une contestation, sa référence. Nullable.
  "contestationRef"     TEXT,

  CONSTRAINT "LaundryTrailPublicationLog_reason_not_blank"
    CHECK (length(btrim("reason")) > 0),
  CONSTRAINT "LaundryTrailPublicationLog_actorId_not_blank"
    CHECK (length(btrim("actorId")) > 0),
  CONSTRAINT "LaundryTrailPublicationLog_actorId_not_admin"
    CHECK (lower(btrim("actorId")) <> 'admin'),
  CONSTRAINT "LaundryTrailPublicationLog_sha_is_sha256"
    CHECK ("narrativeSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "LaundryTrailPublicationLog_scope_allowed"
    CHECK ("scope" IN (
      'trail_full',       -- la ligne entière cesse d'être servie
      'trail_narrative',  -- narrativeText / narrativeTextFr seuls
      'trail_risk'        -- laundryRisk seul (badge, drapeau, ancrage du modèle)
    )),
  CONSTRAINT "LaundryTrailPublicationLog_status_allowed"
    CHECK ("fromStatus" IN ('published','withdrawn')
       AND "toStatus"   IN ('published','withdrawn')),
  CONSTRAINT "LaundryTrailPublicationLog_transition_is_real"
    CHECK ("fromStatus" <> "toStatus"),
  -- Liste FERMÉE, alignée mot pour mot sur celle de
  -- KolProceedsPublicationLog_reasonCode_allowed. Deux registres qui parlent de
  -- publication nominative doivent s'agréger ensemble.
  CONSTRAINT "LaundryTrailPublicationLog_reasonCode_allowed"
    CHECK ("reasonCode" IN (
      'approved',             -- remise en publication
      'rejected',
      'contested',            -- contestation reçue et honorée
      'erratum',              -- assertion chiffrée matériellement incorrecte
      'evidence_withdrawn',   -- la preuve qui fondait l'affirmation ne tient plus
      'legal',
      'duplicate',
      'other'
    ))
);

-- Historique complet d'un trail, du plus récent au plus ancien.
CREATE INDEX IF NOT EXISTS "LaundryTrailPublicationLog_trailId_createdAt_idx"
  ON "LaundryTrailPublicationLog" ("trailId", "createdAt" DESC);

-- Historique complet d'une personne, tous trails confondus.
CREATE INDEX IF NOT EXISTS "LaundryTrailPublicationLog_kolHandle_createdAt_idx"
  ON "LaundryTrailPublicationLog" ("kolHandle", "createdAt" DESC);

-- Agrégation par motif — combien de retraits pour erratum, pour preuve
-- insuffisante. Matière de la démonstration de contrôle éditorial, et
-- agrégeable avec KolProceedsPublicationLog puisque la liste est la même.
CREATE INDEX IF NOT EXISTS "LaundryTrailPublicationLog_reasonCode_idx"
  ON "LaundryTrailPublicationLog" ("reasonCode");

-- Retrouver le dossier de contestation.
CREATE INDEX IF NOT EXISTS "LaundryTrailPublicationLog_contestationRef_idx"
  ON "LaundryTrailPublicationLog" ("contestationRef")
  WHERE "contestationRef" IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════
-- 2. L'ÉTAT COURANT
-- ══════════════════════════════════════════════════════════════════════════
--
-- Une colonne additive. narrativeText, narrativeTextFr, laundryRisk et les
-- signaux ne sont JAMAIS touchés : le texte reste lisible en base, en admin, et
-- par toute réinvestigation. Seule sa PUBLICATION bascule. C'est ce qui rend le
-- retrait réversible sans perte — et c'est le point de toute la migration.
--
-- DEFAULT 'published' : les 5 lignes existantes gardent leur comportement
-- actuel. AUCUN état n'est basculé par cette migration.

ALTER TABLE "LaundryTrail"
  ADD COLUMN IF NOT EXISTS "publication" TEXT NOT NULL DEFAULT 'published';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'LaundryTrail_publication_allowed'
  ) THEN
    ALTER TABLE "LaundryTrail"
      ADD CONSTRAINT "LaundryTrail_publication_allowed"
      CHECK ("publication" IN ('published','withdrawn'));
  END IF;
END $$;

-- Les six surfaces filtrent sur cette colonne à chaque lecture de trail.
CREATE INDEX IF NOT EXISTS "LaundryTrail_publication_idx"
  ON "LaundryTrail" ("publication");

-- Lecture publique la plus fréquente : le trail d'un handle, s'il est publié.
CREATE INDEX IF NOT EXISTS "LaundryTrail_kolHandle_publication_idx"
  ON "LaundryTrail" ("kolHandle", "publication");

-- ─── VÉRIFICATION POST-EXÉCUTION ──────────────────────────────────────────
--
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'LaundryTrailPublicationLog'
--    ORDER BY ordinal_position;
--
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = '"LaundryTrailPublicationLog"'::regclass;
--
--   -- Doit rendre 5 lignes 'published', 0 'withdrawn' :
--   SELECT "publication", count(*) FROM "LaundryTrail" GROUP BY 1;
--
--   -- Doit rendre 0 : le registre s'ouvre vide.
--   SELECT count(*) FROM "LaundryTrailPublicationLog";
--
--   -- Empreintes des 5 narratifs, à conserver hors base AVANT toute décision :
--   -- ce sont elles qu'un futur journal devra citer.
--   SELECT id, "kolHandle", encode(sha256(convert_to("narrativeText",'UTF8')),'hex')
--     FROM "LaundryTrail" ORDER BY "createdAt";
--
-- ─── CE QUE CETTE MIGRATION NE FAIT PAS ───────────────────────────────────
--
--   * Elle ne retire RIEN. Elle ouvre le registre et pose l'interrupteur.
--     Les 5 lignes restent 'published'.
--   * Elle ne touche ni narrativeText, ni narrativeTextFr, ni evidenceNote,
--     ni laundryRisk, ni LaundrySignal.
--   * Elle ne décide rien sur bkokoski ni sur sxyz500 : retirer un narratif
--     est une décision de publication nominative, elle appartient au fondateur.
--   * Après exécution, le comportement du produit est INCHANGÉ.
