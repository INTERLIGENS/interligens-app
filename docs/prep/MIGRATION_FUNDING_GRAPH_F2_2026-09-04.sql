-- ═══════════════════════════════════════════════════════════════════════════
-- F2.1 — FUNDING GRAPH : PERSISTANCE
-- À exécuter À LA MAIN dans le Neon SQL Editor (verrou A9 : jamais db push,
-- jamais prisma migrate). ADDITIF — aucune table existante n'est touchée.
-- Base : ep-square-band.  Émis le 2026-09-04.  NON EXÉCUTÉ par Claude Code.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. FundingEdge — un transfert CONSTATÉ ────────────────────────────────
CREATE TABLE "FundingEdge" (
  "id"               TEXT         NOT NULL,
  "fromWallet"       TEXT         NOT NULL,
  "toWallet"         TEXT         NOT NULL,
  "asset"            TEXT         NOT NULL DEFAULT 'SOL',
  "amountLamports"   BIGINT       NOT NULL,
  "txSignature"      TEXT         NOT NULL,
  "blockTimeSeconds" INTEGER      NOT NULL,
  "rowNature"        "DataNature",
  "sourceContext"    TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FundingEdge_pkey" PRIMARY KEY ("id")
);

-- IDEMPOTENCE : une signature = une arête. Rejouer une collecte ne duplique rien.
CREATE UNIQUE INDEX "FundingEdge_txSignature_key" ON "FundingEdge"("txSignature");
CREATE INDEX "FundingEdge_fromWallet_idx"       ON "FundingEdge"("fromWallet");
CREATE INDEX "FundingEdge_toWallet_idx"         ON "FundingEdge"("toWallet");
CREATE INDEX "FundingEdge_blockTimeSeconds_idx" ON "FundingEdge"("blockTimeSeconds");
CREATE INDEX "FundingEdge_sourceContext_idx"    ON "FundingEdge"("sourceContext");

-- CHECK declared : mono-nature. Une arête ne peut pas être une inférence.
-- Pas de CHECK auditable ici : une observation n'a pas de piste d'inférence à
-- produire — elle EST la piste. Exiger un natureBasis reviendrait à demander la
-- justification d'un fait constaté.
ALTER TABLE "FundingEdge"
  ADD CONSTRAINT "fundingedge_rownature_declared_chk"
  CHECK ("rowNature" IS NULL OR "rowNature" = 'PRIMARY_OBSERVATION'::"DataNature")
  NOT VALID;

-- ── 2. FundingRelationshipObservation — une règle APPLIQUÉE ───────────────
CREATE TABLE "FundingRelationshipObservation" (
  "id"                  TEXT         NOT NULL,
  "funderWallet"        TEXT         NOT NULL,
  "contextRef"          TEXT         NOT NULL,
  "subjectsReached"     INTEGER      NOT NULL,
  "category"            TEXT         NOT NULL,
  "evidence"            JSONB        NOT NULL,
  "coverageIsFloor"     BOOLEAN      NOT NULL DEFAULT false,
  "rowNature"           "DataNature",
  "natureBasis"         JSONB,
  "naturePolicyVersion" TEXT,
  "methodRef"           TEXT         NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FundingRelationshipObservation_pkey" PRIMARY KEY ("id")
);

-- IDEMPOTENCE : un bailleur, un contexte, une règle → une ligne. Une règle
-- différente produit une autre ligne — deux versions ne doivent pas s'écraser.
CREATE UNIQUE INDEX "FundingRelationshipObservation_funderWallet_contextRef_methodRef_key"
  ON "FundingRelationshipObservation"("funderWallet", "contextRef", "methodRef");
CREATE INDEX "FundingRelationshipObservation_contextRef_category_idx"
  ON "FundingRelationshipObservation"("contextRef", "category");
CREATE INDEX "FundingRelationshipObservation_funderWallet_idx"
  ON "FundingRelationshipObservation"("funderWallet");

-- CHECK declared : mono-nature INFERENCE.
ALTER TABLE "FundingRelationshipObservation"
  ADD CONSTRAINT "fundingrelobs_rownature_declared_chk"
  CHECK ("rowNature" IS NULL OR "rowNature" = 'INFERENCE'::"DataNature")
  NOT VALID;

-- CHECK auditable : pas de nature sans piste d'audit.
-- Prédicat COPIÉ À L'IDENTIQUE de shillevent_rownature_auditable_chk (lu en
-- base le 2026-09-04) — deux prédicats qui redérivent la même règle finissent
-- par diverger.
ALTER TABLE "FundingRelationshipObservation"
  ADD CONSTRAINT "fundingrelobs_rownature_auditable_chk"
  CHECK (
    ("rowNature" IS NULL)
    OR (
      ("naturePolicyVersion" IS NOT NULL)
      AND (length("naturePolicyVersion") > 0)
      AND ("natureBasis" IS NOT NULL)
      AND (jsonb_typeof("natureBasis") = 'object'::text)
      AND ("natureBasis" <> '{}'::jsonb)
    )
  )
  NOT VALID;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- LES TROIS CHECK SONT « NOT VALID », ET C'EST VOULU.
-- Ils gardent toute écriture À VENIR sans exiger de scan. Les tables sont
-- vides, donc le scan serait instantané — mais VALIDATE reste une étape
-- SÉPARÉE, à ne poser qu'APRÈS que le writer (F2.2) ait prouvé qu'il produit
-- des lignes conformes. Valider avant, c'est ratifier une contrainte que rien
-- n'a encore exercée.
--
-- Une fois le writer prouvé :
--   ALTER TABLE "FundingEdge"
--     VALIDATE CONSTRAINT "fundingedge_rownature_declared_chk";
--   ALTER TABLE "FundingRelationshipObservation"
--     VALIDATE CONSTRAINT "fundingrelobs_rownature_declared_chk";
--   ALTER TABLE "FundingRelationshipObservation"
--     VALIDATE CONSTRAINT "fundingrelobs_rownature_auditable_chk";
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- APRÈS EXÉCUTION — L'ORDRE N'EST PAS NÉGOCIABLE
--
-- L'inscription au registre Data Nature ne peut PAS précéder ce DDL.
-- L'invariant I5 (__tests__/data-nature/invariants.test.ts) exige que le
-- registre ne nomme que des tables réellement présentes, et il les lit dans
-- src/lib/data-nature/__schema-snapshot.json — une MESURE de ep-square-band,
-- pas une liste de souhaits. Y inscrire deux tables inexistantes aurait
-- falsifié la mesure pour faire passer un test.
--
-- Donc, une fois ce DDL exécuté, dans cet ordre :
--   1. rafraîchir __schema-snapshot.json depuis information_schema (178 → 180)
--   2. appliquer les 2 entrées de registre (FundingEdge PRIMARY_OBSERVATION,
--      FundingRelationshipObservation INFERENCE / basis PRIMARY_OBSERVATION +
--      THIRD_PARTY_DATA) — patch prêt, voir la PR F2.1
--   3. la suite repasse verte, et S6 accepte alors l'écriture
--
-- Tant que (2) n'est pas fait, natureForTable rend UNCLASSIFIED sur les deux
-- tables et le chokepoint S6 REFUSE toute écriture de nature. C'est le
-- comportement voulu : rien ne peut être écrit avant d'être déclaré.
-- ═══════════════════════════════════════════════════════════════════════════
