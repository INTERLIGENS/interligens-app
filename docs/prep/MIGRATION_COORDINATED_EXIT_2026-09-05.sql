-- ═══════════════════════════════════════════════════════════════════════════
-- BUILD 6 / PACK C — COORDINATED EXIT : PERSISTANCE
-- À exécuter À LA MAIN dans le Neon SQL Editor (verrou A9 : jamais db push,
-- jamais prisma migrate). ADDITIF — aucune table existante n'est touchée.
-- Base : ep-square-band.  Émis le 2026-09-05.  NON EXÉCUTÉ par Claude Code.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. ExitEvent — un acte CONSTATÉ ───────────────────────────────────────
CREATE TABLE "ExitEvent" (
  "id"                          TEXT         NOT NULL,
  "subjectWallet"               TEXT         NOT NULL,
  "mint"                        TEXT         NOT NULL,
  "type"                        TEXT         NOT NULL,
  "amount"                      BIGINT       NOT NULL,
  "blockTimeSeconds"            INTEGER      NOT NULL,
  "txSignature"                 TEXT         NOT NULL,
  "observedCounterpartyAsset"   TEXT,
  "observedCounterpartyAmount"  BIGINT,
  "observedCounterpartyMeaning" TEXT,
  "destination"                 TEXT,
  "venue"                       TEXT,
  "evidenceProvenance"          JSONB        NOT NULL,
  "rowNature"                   "DataNature",
  "sourceContext"               TEXT         NOT NULL,
  "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExitEvent_pkey" PRIMARY KEY ("id")
);

-- IDEMPOTENCE : une signature = un acte. Rejouer une extraction ne duplique rien.
CREATE UNIQUE INDEX "ExitEvent_txSignature_key"      ON "ExitEvent"("txSignature");
CREATE INDEX "ExitEvent_subjectWallet_mint_idx"      ON "ExitEvent"("subjectWallet", "mint");
CREATE INDEX "ExitEvent_mint_blockTimeSeconds_idx"   ON "ExitEvent"("mint", "blockTimeSeconds");
CREATE INDEX "ExitEvent_sourceContext_type_idx"      ON "ExitEvent"("sourceContext", "type");

-- CHECK declared : mono-nature. Un acte constaté ne peut pas être une inférence.
-- Pas de CHECK auditable : une observation n'a pas de piste d'inférence à
-- produire — elle EST la piste. Exiger un natureBasis reviendrait à demander la
-- justification d'un fait constaté.
ALTER TABLE "ExitEvent"
  ADD CONSTRAINT "exitevent_rownature_declared_chk"
  CHECK ("rowNature" IS NULL OR "rowNature" = 'PRIMARY_OBSERVATION'::"DataNature")
  NOT VALID;

-- ── 2. CoExitQualification — une règle APPLIQUÉE ──────────────────────────
CREATE TABLE "CoExitQualification" (
  "id"                      TEXT         NOT NULL,
  "contextRef"              TEXT         NOT NULL,
  "groupKey"                TEXT         NOT NULL,
  "mint"                    TEXT         NOT NULL,
  "category"                TEXT         NOT NULL,
  "distinctSubjects"        INTEGER      NOT NULL,
  "pairsWithinWindow"       INTEGER      NOT NULL,
  "windowSeconds"           INTEGER      NOT NULL,
  "minGapSeconds"           INTEGER,
  "medianGapSeconds"        INTEGER,
  "spanSeconds"             INTEGER      NOT NULL,
  "demonstratedVenue"       TEXT,
  "demonstratedDestination" TEXT,
  "sellCount"               INTEGER      NOT NULL,
  "outgoingCount"           INTEGER      NOT NULL,
  "coverageAnyIncomplete"   BOOLEAN      NOT NULL DEFAULT false,
  "materialityStatus"       TEXT         NOT NULL,
  "evidence"                JSONB        NOT NULL,
  "rowNature"               "DataNature",
  "natureBasis"             JSONB,
  "naturePolicyVersion"     TEXT,
  "methodRef"               TEXT         NOT NULL,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoExitQualification_pkey" PRIMARY KEY ("id")
);

-- IDEMPOTENCE : un contexte, un groupe, une règle → une ligne. Une règle
-- différente produit une AUTRE ligne — deux versions ne s'écrasent pas.
CREATE UNIQUE INDEX "CoExitQualification_contextRef_groupKey_methodRef_key"
  ON "CoExitQualification"("contextRef", "groupKey", "methodRef");
CREATE INDEX "CoExitQualification_contextRef_category_idx"
  ON "CoExitQualification"("contextRef", "category");
CREATE INDEX "CoExitQualification_mint_idx" ON "CoExitQualification"("mint");

-- CHECK declared : mono-nature INFERENCE.
ALTER TABLE "CoExitQualification"
  ADD CONSTRAINT "coexitqual_rownature_declared_chk"
  CHECK ("rowNature" IS NULL OR "rowNature" = 'INFERENCE'::"DataNature")
  NOT VALID;

-- CHECK auditable : pas de nature sans piste d'audit.
-- Prédicat COPIÉ À L'IDENTIQUE de shillevent_rownature_auditable_chk (lu en
-- base le 2026-09-04) — deux prédicats qui redérivent la même règle finissent
-- par diverger.
ALTER TABLE "CoExitQualification"
  ADD CONSTRAINT "coexitqual_rownature_auditable_chk"
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
-- Ils gardent toute écriture À VENIR sans exiger de scan. VALIDATE reste une
-- étape SÉPARÉE, à ne poser qu'APRÈS que le writer ait prouvé qu'il produit des
-- lignes conformes. Valider avant, c'est ratifier une contrainte que rien n'a
-- encore exercée.
--
-- APRÈS EXÉCUTION — L'ORDRE N'EST PAS NÉGOCIABLE :
--   1. rafraîchir src/lib/data-nature/__schema-snapshot.json (180 → 182)
--   2. appliquer les 2 entrées de registre (patch préparé : docs/prep/
--      REGISTRY_PATCH_COORDINATED_EXIT_2026-09-05.txt)
--   3. la suite repasse verte, et S6 accepte alors l'écriture
--
-- Tant que (2) n'est pas fait, natureForTable rend UNCLASSIFIED sur les deux
-- tables et le writer REFUSE de construire la moindre ligne — comportement
-- voulu, prouvé par test (« FAIL-CLOSED : sans entrée au registre, aucune ligne
-- n'est construite »).
-- ═══════════════════════════════════════════════════════════════════════════
