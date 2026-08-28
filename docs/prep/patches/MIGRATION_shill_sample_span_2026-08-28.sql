-- MIGRATION ADDITIVE — persistance de l'état de mesure du profil de wallet.
-- À exécuter dans le Neon SQL Editor (prisma migrate est verrouillé, A9).
-- Base : ep-square-band. Additive, réversible par DROP COLUMN, sans backfill.
--
-- POURQUOI
-- wallet-profile.ts calcule déjà sampleSpanDays et sampleSaturated, puis les
-- jette. Sans eux en base, deux choses sont impossibles :
--   1. rejouer un vetting sans rappeler Helius ;
--   2. auditer si une exclusion passée reposait sur une mesure ou sur un plafond.
-- La densité (SHILL-C1/D2) est déjà opérante EN MÉMOIRE ; ces colonnes la
-- rendent auditable et rejouable.

ALTER TABLE "ShillCorrelationCandidate"
  ADD COLUMN IF NOT EXISTS "walletSampleSpanDays"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "walletSampleSize"      INTEGER,
  ADD COLUMN IF NOT EXISTS "walletSampleSaturated" BOOLEAN;

COMMENT ON COLUMN "ShillCorrelationCandidate"."walletSampleSpanDays" IS
  'Durée couverte par l''échantillon de signatures. Avec walletSampleSize, donne la densité (tx/jour) — la seule mesure de fréquence qui survive à la saturation du sampler.';
COMMENT ON COLUMN "ShillCorrelationCandidate"."walletSampleSaturated" IS
  'SHILL-C2 : propriété de MESURE, jamais une affirmation comportementale. true => walletTxCount30d est un plancher, pas un comptage.';
