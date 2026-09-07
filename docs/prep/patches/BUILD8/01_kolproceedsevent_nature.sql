-- ═══════════════════════════════════════════════════════════════════════════
-- BUILD 8 / P3 — KolProceedsEvent : la nature du montant
--
-- ██  RÉDIGÉE, NON EXÉCUTÉE. Elle revient à T1, via l'éditeur SQL Neon.     ██
-- ██  Cible : ep-square-band. ADDITIVE UNIQUEMENT — aucun DROP, aucun       ██
-- ██  ALTER de colonne existante, aucune donnée modifiée hors des trois     ██
-- ██  colonnes créées par ce fichier.                                       ██
--
-- ─── Pourquoi cette table, et elle seule ───────────────────────────────────
--
-- 5 602 lignes, 17,5 M$, et DEUX natures dans la même colonne `amountUsd` :
-- 5 414 lignes valorisées par un prix tiers (17 396 879 $) à côté de 188
-- valorisées par une constante posée par le produit (156 153 $). Rien dans la
-- table ne les distingue. C'est le site de mélange M4, appliqué à l'argent.
--
-- ─── La règle de classement n'est PAS écrite ici ───────────────────────────
--
-- Elle vit dans src/lib/kol-memory/proceedsNature.ts (`classifyAmountUsd`).
-- Le backfill ci-dessous en est la TRANSCRIPTION, et
-- __tests__/kol-memory/proceedsNature.test.ts compare les deux branche par
-- branche. Écrire la règle deux fois sans les confronter est le mécanisme par
-- lequel une base et son code divergent en silence.
--
-- ─── Ordre d'application ───────────────────────────────────────────────────
--   1. colonnes            (transaction 1, instantanée)
--   2. backfill            (transaction 2, 5 602 lignes)
--   3. contrôles           (lecture seule — DOIVENT tous passer)
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. COLONNES ────────────────────────────────────────────────────────────
--
-- Le type "DataNature" existe DÉJÀ en base (vérifié le 2026-09-07 :
-- PRIMARY_OBSERVATION, THIRD_PARTY_DATA, INFERENCE, ESTIMATE,
-- EDITORIAL_ASSERTION, UNCLASSIFIED). Rien à créer.
--
-- Les trois colonnes sont NULLABLE et sans DEFAULT. C'est délibéré : un DEFAULT
-- donnerait une nature à toute ligne future qui n'en déclare pas — précisément
-- le défaut implicite que la doctrine interdit. NULL veut dire « pas encore
-- classé », et le lecteur applicatif le rend UNCLASSIFIED, donc impubliable.

BEGIN;

ALTER TABLE "KolProceedsEvent"
  ADD COLUMN IF NOT EXISTS "amountUsdNature"   "DataNature",
  ADD COLUMN IF NOT EXISTS "amountUsdBasis"    jsonb,
  ADD COLUMN IF NOT EXISTS "amountUsdMethodRef" text;

COMMENT ON COLUMN "KolProceedsEvent"."amountUsdNature" IS
  'BUILD 8 / P3 — nature du MONTANT, distincte de celle de la ligne. amountUsd '
  'est calculé (quantité x prix) : sa nature se lit dans pricingSource. '
  'NULL = non classé = impubliable. Spec : src/lib/kol-memory/proceedsNature.ts';

COMMENT ON COLUMN "KolProceedsEvent"."amountUsdBasis" IS
  'BUILD 8 / P3 — auditabilite d''une ESTIMATE par son BASIS a defaut d''une '
  'methodologie gelee qui la couvre (writeGuard.assertEstimateAuditable). '
  'Porte la formule, les natures d''entree, la constante employee et son origine.';

COMMENT ON COLUMN "KolProceedsEvent"."amountUsdMethodRef" IS
  'BUILD 8 / P3 — reference de methode, grammaire <slug>/<composant>@v<N>. '
  'Laisse NULL tant qu''aucune methodologie gelee ne decrit reellement la '
  'valorisation employee : en inventer une serait pire que de n''en citer aucune.';

-- La grammaire canonique du methodRef, reproduite depuis
-- src/lib/data-nature/methodRef.ts (METHOD_REF_SQL_PATTERN). NULL reste permis.
ALTER TABLE "KolProceedsEvent"
  DROP CONSTRAINT IF EXISTS "KolProceedsEvent_amountUsdMethodRef_grammar";
ALTER TABLE "KolProceedsEvent"
  ADD CONSTRAINT "KolProceedsEvent_amountUsdMethodRef_grammar"
  CHECK (
    "amountUsdMethodRef" IS NULL
    OR "amountUsdMethodRef" ~ '^[a-z][a-z0-9-]{1,63}/[a-z][a-z0-9-]{1,63}@v[0-9]+$'
  );

-- Une ESTIMATE doit rester auditable : methodRef valide OU basis non vide.
-- C'est assertEstimateAuditable, porté par la base pour que l'invariant
-- survive à un writer qui ne passerait pas par le chokepoint applicatif.
ALTER TABLE "KolProceedsEvent"
  DROP CONSTRAINT IF EXISTS "KolProceedsEvent_estimate_auditable";
ALTER TABLE "KolProceedsEvent"
  ADD CONSTRAINT "KolProceedsEvent_estimate_auditable"
  CHECK (
    "amountUsdNature" IS DISTINCT FROM 'ESTIMATE'
    OR "amountUsdMethodRef" IS NOT NULL
    OR ("amountUsdBasis" IS NOT NULL AND "amountUsdBasis" <> '{}'::jsonb)
  );

CREATE INDEX IF NOT EXISTS "KolProceedsEvent_amountUsdNature_idx"
  ON "KolProceedsEvent" ("amountUsdNature");

COMMIT;


-- ── 2. BACKFILL ────────────────────────────────────────────────────────────
--
-- Transcription de `classifyAmountUsd`. L'ordre des branches REPRODUIT celui
-- du TypeScript : les deux refus généraux d'abord (montant absent, ligne
-- ambiguë), puis le classement par pricingSource. Inverser l'ordre changerait
-- le résultat des lignes ambiguës qui portent un montant.

BEGIN;

-- 2.a — montant absent : rien à classer. Reste NULL, donc UNCLASSIFIED à la
--       lecture. Aucune écriture : on ne pose pas une nature sur du vide.

-- 2.b — ligne marquée ambiguë par le produit : on ne tranche pas à sa place.
--       Reste NULL également. (2 lignes mesurées, toutes CEX_DETECTED.)

-- 2.c — binance_historical → INFERENCE
UPDATE "KolProceedsEvent" SET
  "amountUsdNature" = 'INFERENCE',
  "amountUsdBasis"  = jsonb_build_object(
    'formula',          'amountUsd = quantité constatée on-chain × clôture quotidienne Binance',
    'inputs',           jsonb_build_array('PRIMARY_OBSERVATION', 'THIRD_PARTY_DATA'),
    'priceResolution',  'DAY'
  )
WHERE "amountUsd" IS NOT NULL
  AND "ambiguous" = false
  AND "pricingSource" = 'binance_historical'
  AND "amountUsdNature" IS NULL;

-- 2.d — yearly_fallback → ESTIMATE (auditable par son basis)
UPDATE "KolProceedsEvent" SET
  "amountUsdNature" = 'ESTIMATE',
  "amountUsdBasis"  = jsonb_build_object(
    'formula',          'amountUsd = quantité constatée on-chain × constante annuelle',
    'inputs',           jsonb_build_array('PRIMARY_OBSERVATION'),
    'priceResolution',  'PERIOD',
    'constant',         jsonb_build_object(
      'name',   'YEARLY_FALLBACK',
      'value',  'SOL 2024:120 · 2025:145 · 2026:185 (USD)',
      'origin', 'src/lib/kol/pricing.ts — valeurs codées en dur'
    )
  )
WHERE "amountUsd" IS NOT NULL
  AND "ambiguous" = false
  AND "pricingSource" = 'yearly_fallback'
  AND "amountUsdNature" IS NULL;

-- 2.e — helius_sol_estimate_200usd → ESTIMATE (auditable par son basis)
UPDATE "KolProceedsEvent" SET
  "amountUsdNature" = 'ESTIMATE',
  "amountUsdBasis"  = jsonb_build_object(
    'formula',          'prix du token dérivé d''un swap libellé en SOL, valorisé à une constante SOL',
    'inputs',           jsonb_build_array('PRIMARY_OBSERVATION'),
    'priceResolution',  'PERIOD',
    'constant',         jsonb_build_object(
      'name',   'SOL_PRICE_ESTIMATE',
      'value',  '200 USD (fenêtre janvier–février 2025)',
      'origin', 'src/scripts/seed/botifyKolScan.ts — constante de seeding'
    )
  )
WHERE "amountUsd" IS NOT NULL
  AND "ambiguous" = false
  AND "pricingSource" = 'helius_sol_estimate_200usd'
  AND "amountUsdNature" IS NULL;

-- 2.f — imports Arkham → THIRD_PARTY_DATA (relais, pas calcul)
UPDATE "KolProceedsEvent" SET
  "amountUsdNature" = 'THIRD_PARTY_DATA',
  "amountUsdBasis"  = jsonb_build_object(
    'formula',          'amountUsd repris tel quel de la source',
    'inputs',           jsonb_build_array('THIRD_PARTY_DATA'),
    'priceResolution',  'NONE'
  )
WHERE "amountUsd" IS NOT NULL
  AND "ambiguous" = false
  AND "pricingSource" IN ('ARKHAM_CSV', 'arkham_aggregate')
  AND "amountUsdNature" IS NULL;

-- 2.g — tout le reste reste NULL, délibérément. `CEX_DETECTED` et toute
--       pricingSource future inconnue exigent un classement humain.

COMMIT;


-- ── 3. CONTRÔLES ───────────────────────────────────────────────────────────
-- Lecture seule. Les cinq DOIVENT passer avant que la migration soit déclarée
-- appliquée. Chiffres attendus = mesure du 2026-09-07 ; un écart signifie que
-- la table a bougé depuis, pas que la migration a échoué — le relire, ne pas
-- le forcer.

-- 3.1 — répartition obtenue. Attendu :
--       INFERENCE 5 407 · ESTIMATE 112 · THIRD_PARTY_DATA 7 · NULL 76
--       (ESTIMATE = 59 helius chiffrées + 53 yearly ; NULL = 74 helius sans
--        montant + 2 CEX_DETECTED ambiguës)
SELECT COALESCE("amountUsdNature"::text, '(non classé)') AS nature,
       count(*) AS lignes,
       round(sum("amountUsd")::numeric, 2) AS usd
  FROM "KolProceedsEvent"
 GROUP BY 1 ORDER BY lignes DESC;

-- 3.2 — AUCUNE ESTIMATE inauditable. Doit rendre 0.
SELECT count(*) AS estimates_inauditables
  FROM "KolProceedsEvent"
 WHERE "amountUsdNature" = 'ESTIMATE'
   AND "amountUsdMethodRef" IS NULL
   AND ("amountUsdBasis" IS NULL OR "amountUsdBasis" = '{}'::jsonb);

-- 3.3 — AUCUN montant classé sans montant. Doit rendre 0.
SELECT count(*) AS natures_sans_montant
  FROM "KolProceedsEvent"
 WHERE "amountUsdNature" IS NOT NULL AND "amountUsd" IS NULL;

-- 3.4 — AUCUNE ligne ambiguë classée. Doit rendre 0.
SELECT count(*) AS ambigues_classees
  FROM "KolProceedsEvent"
 WHERE "ambiguous" = true AND "amountUsdNature" IS NOT NULL;

-- 3.5 — la séparation qui justifie tout le patch : le mélange est-il défait ?
--       Doit montrer deux lignes nettement séparées, plus jamais une seule somme.
SELECT "amountUsdNature"::text AS nature,
       count(*) AS lignes,
       round(sum("amountUsd")::numeric, 2) AS usd
  FROM "KolProceedsEvent"
 WHERE "amountUsdNature" IN ('INFERENCE', 'ESTIMATE', 'THIRD_PARTY_DATA')
 GROUP BY 1 ORDER BY usd DESC;


-- ── ROLLBACK ───────────────────────────────────────────────────────────────
-- Additif pur : le retrait est symétrique et ne perd aucune donnée d'origine.
--
--   ALTER TABLE "KolProceedsEvent"
--     DROP CONSTRAINT IF EXISTS "KolProceedsEvent_estimate_auditable",
--     DROP CONSTRAINT IF EXISTS "KolProceedsEvent_amountUsdMethodRef_grammar";
--   DROP INDEX IF EXISTS "KolProceedsEvent_amountUsdNature_idx";
--   ALTER TABLE "KolProceedsEvent"
--     DROP COLUMN IF EXISTS "amountUsdNature",
--     DROP COLUMN IF EXISTS "amountUsdBasis",
--     DROP COLUMN IF EXISTS "amountUsdMethodRef";
