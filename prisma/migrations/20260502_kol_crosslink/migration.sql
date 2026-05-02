-- Migration additive: crée la table KolCrossLink
-- Utilisée par crossCaseLinker.ts pour persister les liens inter-KOL détectés
-- (shared_wallet, shared_token, shared_deployer, shared_cex_deposit)
-- À appliquer dans Neon SQL Editor (ep-square-band)

CREATE TABLE IF NOT EXISTS "KolCrossLink" (
  "id"           TEXT        NOT NULL,
  "sourceHandle" TEXT        NOT NULL,
  "targetHandle" TEXT        NOT NULL,
  "linkType"     TEXT        NOT NULL,
  "confidence"   TEXT        NOT NULL,
  "evidence"     JSONB       NOT NULL,
  "detectedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "KolCrossLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KolCrossLink_source_target_type_key"
    UNIQUE ("sourceHandle", "targetHandle", "linkType")
);

CREATE INDEX IF NOT EXISTS "KolCrossLink_sourceHandle_idx" ON "KolCrossLink" ("sourceHandle");
CREATE INDEX IF NOT EXISTS "KolCrossLink_targetHandle_idx" ON "KolCrossLink" ("targetHandle");
