-- ═══════════════════════════════════════════════════════════════════════════
-- S3 · TABLE 1/5 — KolTokenLink · régime FIELD · 292 lignes
--
-- M5 : quatre natures cohabitent sur une même ligne. Le registre
-- (src/lib/data-nature/registry.ts) fait foi :
--     contractAddress → PRIMARY_OBSERVATION
--     canonicalMint   → INFERENCE
--     note            → EDITORIAL_ASSERTION
--     rowDefault      → sourceType='watcher' ? PRIMARY_OBSERVATION : EDITORIAL_ASSERTION
--
-- Les 117 lignes dont contractAddress commence par 'PENDING:' ne portent
-- AUCUNE identité : elles restent UNCLASSIFIED, ce qui les exclut de toute
-- sortie publique. C'est le comportement voulu, pas un effet de bord.
--
-- Mesuré le 2026-08-28 (ep-square-band, lecture seule) :
--     sourceType   manual_seed 185 · watcher 107
--     PENDING:*    117 · adresses réelles 175
--     canonicalMint renseigné 107 · note renseignée 292
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── DDL — additif, colonnes NULLABLES sans DEFAULT (aucune réécriture) ────
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "contractAddressNature" "DataNature";
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "canonicalMintNature"   "DataNature";
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "noteNature"            "DataNature";
ALTER TABLE "KolTokenLink" ADD COLUMN IF NOT EXISTS "rowNature"             "DataNature";

-- ─── BACKFILL — déterministe, par prédicat, JAMAIS un UPDATE global ───────
-- Chaque UPDATE est gardé par `IS NULL` : le fichier est rejouable sans dégât.
-- La leçon MmClaimType.FACT (§Q6) est qu'une même valeur source peut mapper
-- vers deux natures selon la jointure — d'où un prédicat explicite par cas.

-- 1. contractAddress — une adresse réellement constatée.
UPDATE "KolTokenLink"
   SET "contractAddressNature" = 'PRIMARY_OBSERVATION'
 WHERE "contractAddressNature" IS NULL
   AND "contractAddress" IS NOT NULL
   AND "contractAddress" NOT LIKE 'PENDING:%';          -- attendu : 175

-- 2. contractAddress — les PENDING:* ne sont pas une identité.
UPDATE "KolTokenLink"
   SET "contractAddressNature" = 'UNCLASSIFIED'
 WHERE "contractAddressNature" IS NULL
   AND "contractAddress" LIKE 'PENDING:%';              -- attendu : 117

-- 3. canonicalMint — résultat d'une résolution, donc une inférence.
UPDATE "KolTokenLink"
   SET "canonicalMintNature" = 'INFERENCE'
 WHERE "canonicalMintNature" IS NULL
   AND "canonicalMint" IS NOT NULL;                     -- attendu : 107

-- 4. note — texte rédigé par l'équipe.
UPDATE "KolTokenLink"
   SET "noteNature" = 'EDITORIAL_ASSERTION'
 WHERE "noteNature" IS NULL
   AND "note" IS NOT NULL;                              -- attendu : 292

-- 5. rowDefault — le watcher CONSTATE, le seed manuel AFFIRME.
UPDATE "KolTokenLink"
   SET "rowNature" = 'PRIMARY_OBSERVATION'
 WHERE "rowNature" IS NULL AND "sourceType" = 'watcher';        -- attendu : 107
UPDATE "KolTokenLink"
   SET "rowNature" = 'EDITORIAL_ASSERTION'
 WHERE "rowNature" IS NULL AND "sourceType" IS DISTINCT FROM 'watcher';  -- attendu : 185

-- ─── VÉRIFICATION ─────────────────────────────────────────────────────────
SELECT 'contractAddress' AS champ, COALESCE("contractAddressNature"::text,'(NULL)') AS nature, count(*)::int
  FROM "KolTokenLink" GROUP BY 2
UNION ALL SELECT 'canonicalMint', COALESCE("canonicalMintNature"::text,'(NULL)'), count(*)::int
  FROM "KolTokenLink" GROUP BY 2
UNION ALL SELECT 'note', COALESCE("noteNature"::text,'(NULL)'), count(*)::int
  FROM "KolTokenLink" GROUP BY 2
UNION ALL SELECT 'row', COALESCE("rowNature"::text,'(NULL)'), count(*)::int
  FROM "KolTokenLink" GROUP BY 2
 ORDER BY 1, 2;

-- ATTENDU :
--   canonicalMint    (NULL) 185 · INFERENCE 107
--   contractAddress  PRIMARY_OBSERVATION 175 · UNCLASSIFIED 117
--   note             EDITORIAL_ASSERTION 292
--   row              EDITORIAL_ASSERTION 185 · PRIMARY_OBSERVATION 107
-- Toute autre répartition = NE PAS CONTINUER, la donnée a bougé depuis la mesure.

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- ALTER TABLE "KolTokenLink" DROP COLUMN IF EXISTS "contractAddressNature";
-- ALTER TABLE "KolTokenLink" DROP COLUMN IF EXISTS "canonicalMintNature";
-- ALTER TABLE "KolTokenLink" DROP COLUMN IF EXISTS "noteNature";
-- ALTER TABLE "KolTokenLink" DROP COLUMN IF EXISTS "rowNature";
