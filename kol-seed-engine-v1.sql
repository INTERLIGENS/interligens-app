-- ─────────────────────────────────────────────────────────────────────────────
-- KOL SEED ENGINE v1 — Migration prod-safe
-- Basée sur le schema réel ep-square-band
-- 100% idempotente : IF NOT EXISTS partout
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Nouveaux champs sur KolProfile
ALTER TABLE "KolProfile"
  ADD COLUMN IF NOT EXISTS "publishStatus"           TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "internalNote"            TEXT,
  ADD COLUMN IF NOT EXISTS "walletAttributionStatus" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "evidenceStatus"          TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "proceedsStatus"          TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "editorialStatus"         TEXT NOT NULL DEFAULT 'pending';

-- Sync publishStatus depuis publishable existant (one-time safe)
UPDATE "KolProfile"
  SET "publishStatus" = 'published'
  WHERE "publishable" = true AND "publishStatus" = 'draft';

-- 2. Nouveaux champs sur KolWallet
ALTER TABLE "KolWallet"
  ADD COLUMN IF NOT EXISTS "confidence"        TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS "attributionSource" TEXT,
  ADD COLUMN IF NOT EXISTS "attributionNote"   TEXT;

-- 3. Champ dedupKey sur KolEvidence (table existante)
ALTER TABLE "KolEvidence"
  ADD COLUMN IF NOT EXISTS "dedupKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "KolEvidence_kolHandle_dedupKey_key"
  ON "KolEvidence"("kolHandle", "dedupKey")
  WHERE "dedupKey" IS NOT NULL;

-- 4. Nouvelle table KolAlias
CREATE TABLE IF NOT EXISTS "KolAlias" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
  "kolHandle" TEXT NOT NULL,
  "alias"     TEXT NOT NULL,
  "type"      TEXT NOT NULL DEFAULT 'secondary',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KolAlias_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KolAlias_kolHandle_fkey"
    FOREIGN KEY ("kolHandle") REFERENCES "KolProfile"("handle")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "KolAlias_kolHandle_alias_key"
  ON "KolAlias"("kolHandle", "alias");

CREATE INDEX IF NOT EXISTS "KolAlias_alias_idx" ON "KolAlias"("alias");

-- 5. Nouvelle table KolTokenLink
CREATE TABLE IF NOT EXISTS "KolTokenLink" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid(),
  "kolHandle"       TEXT NOT NULL,
  "contractAddress" TEXT NOT NULL,
  "chain"           TEXT NOT NULL,
  "tokenSymbol"     TEXT,
  "role"            TEXT NOT NULL DEFAULT 'promoter',
  "note"            TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KolTokenLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KolTokenLink_kolHandle_fkey"
    FOREIGN KEY ("kolHandle") REFERENCES "KolProfile"("handle")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "KolTokenLink_kolHandle_contract_chain_key"
  ON "KolTokenLink"("kolHandle", "contractAddress", "chain");

CREATE INDEX IF NOT EXISTS "KolTokenLink_kolHandle_idx" ON "KolTokenLink"("kolHandle");

-- 6. Index de performance
CREATE INDEX IF NOT EXISTS "KolProfile_publishStatus_idx"   ON "KolProfile"("publishStatus");
CREATE INDEX IF NOT EXISTS "KolProfile_editorialStatus_idx" ON "KolProfile"("editorialStatus");
CREATE INDEX IF NOT EXISTS "KolWallet_confidence_idx"       ON "KolWallet"("confidence");

-- 7. Vérification finale
SELECT
  (SELECT COUNT(*) FROM "KolProfile")                                     AS total_profiles,
  (SELECT COUNT(*) FROM "KolProfile" WHERE "publishStatus" = 'published') AS published,
  (SELECT COUNT(*) FROM "KolProfile" WHERE "publishStatus" = 'draft')     AS draft,
  (SELECT COUNT(*) FROM "KolWallet")                                      AS total_wallets,
  (SELECT COUNT(*) FROM "KolAlias")                                       AS total_aliases,
  (SELECT COUNT(*) FROM "KolEvidence")                                    AS total_evidences,
  (SELECT COUNT(*) FROM "KolTokenLink")                                   AS total_token_links;
