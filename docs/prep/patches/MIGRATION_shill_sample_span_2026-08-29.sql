-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION ADDITIVE — Shill Correlation : mesure + audit de supersession
-- Base   : ep-square-band (Production)
-- À exécuter : Neon SQL Editor. `prisma migrate` est verrouillé (A9, P1012).
-- Propriétés : additive, idempotente, réversible par DROP COLUMN,
--              AUCUN DEFAULT inventé, AUCUN backfill, AUCUNE donnée réécrite.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- BLOC 1 — état de MESURE du profil de wallet (SHILL-C1 / SHILL-C2)
--
-- wallet-profile.ts calcule déjà sampleSpanDays, sampleSize et sampleSaturated,
-- puis les jette. Sans eux en base, deux choses restent impossibles :
--   1. rejouer un vetting sans rappeler Helius ;
--   2. auditer si une exclusion passée reposait sur une mesure ou sur un plafond.
-- La densité (walletSampleSize / walletSampleSpanDays) est la SEULE mesure de
-- fréquence qui survive à la saturation du sampler de signatures.
--
-- BLOC 2 — audit de SUPERSESSION (exigence : aucun écrasement silencieux)
--
-- La réévaluation va remplacer 21 excludedReason='high_frequency'. Sans ces
-- colonnes, le fait que ces wallets aient été classés sous une doctrine depuis
-- invalidée DISPARAÎTRAIT de la base. L'audit doit montrer non seulement
-- l'ancienne raison, mais POURQUOI elle est superseded : son entrée était
-- censurée par le sampler (walletTxCount30d=1000 = plafond, pas un comptage).

ALTER TABLE "ShillCorrelationCandidate"
  -- Bloc 1 — mesure
  ADD COLUMN IF NOT EXISTS "walletSampleSpanDays"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "walletSampleSize"       INTEGER,
  ADD COLUMN IF NOT EXISTS "walletSampleSaturated"  BOOLEAN,
  -- Bloc 2 — audit de supersession
  ADD COLUMN IF NOT EXISTS "previousExcludedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "exclusionSupersededAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "exclusionSupersededBy"  TEXT,
  ADD COLUMN IF NOT EXISTS "exclusionSupersededWhy" TEXT;

COMMENT ON COLUMN "ShillCorrelationCandidate"."walletSampleSpanDays" IS
  'Durée (jours) couverte par l''échantillon de signatures. Avec walletSampleSize, donne la densité tx/jour — seule mesure de fréquence qui survive à la saturation du sampler.';

COMMENT ON COLUMN "ShillCorrelationCandidate"."walletSampleSaturated" IS
  'SHILL-C2 : propriété de MESURE, jamais une affirmation comportementale. true => walletTxCount30d est un plancher, pas un comptage.';

COMMENT ON COLUMN "ShillCorrelationCandidate"."previousExcludedReason" IS
  'Motif d''exclusion sous la doctrine précédente. Conservé pour que la réévaluation n''efface pas l''historique. NULL = jamais superseded.';

COMMENT ON COLUMN "ShillCorrelationCandidate"."exclusionSupersededWhy" IS
  'Pourquoi l''ancien motif ne vaut plus. Pour high_frequency : entrée censurée par le sampler (limit=1000), un plafond n''est pas une mesure — SHILL-C1.';

-- ── VÉRIFICATION (à exécuter juste après, doit rendre 7 lignes) ─────────────
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name   = 'ShillCorrelationCandidate'
--    AND column_name IN ('walletSampleSpanDays','walletSampleSize','walletSampleSaturated',
--                        'previousExcludedReason','exclusionSupersededAt',
--                        'exclusionSupersededBy','exclusionSupersededWhy')
--  ORDER BY column_name;

-- ── ROLLBACK (aucune donnée n'est perdue tant que la réévaluation n'a pas eu lieu)
-- ALTER TABLE "ShillCorrelationCandidate"
--   DROP COLUMN IF EXISTS "walletSampleSpanDays",
--   DROP COLUMN IF EXISTS "walletSampleSize",
--   DROP COLUMN IF EXISTS "walletSampleSaturated",
--   DROP COLUMN IF EXISTS "previousExcludedReason",
--   DROP COLUMN IF EXISTS "exclusionSupersededAt",
--   DROP COLUMN IF EXISTS "exclusionSupersededBy",
--   DROP COLUMN IF EXISTS "exclusionSupersededWhy";
