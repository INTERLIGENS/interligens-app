-- ═══════════════════════════════════════════════════════════════════════════
-- W2 · FICHIER 0/3 — DDL additif · 3 colonnes · 0 ligne écrite
--
-- Le champ qui manquait. Les 482 M$ n'avaient nulle part où être rangés
-- correctement : la seule colonne monétaire disponible s'appelait
-- estimatedRetailHarmUsd, et le chiffre y a atterri faute de mieux.
--
--   insiderExitNotionalValueUsd        la valeur notionnelle elle-même
--   insiderExitNotionalValueUsdNature  sa nature (ESTIMATE)
--   insiderExitNotionalBasis           le natureBasis, en jsonb
--
-- Le troisième n'est pas un confort. Une ESTIMATE dont on ne peut pas relire
-- les entrées n'est pas auditable : la nature dit « c'est une estimation »,
-- le basis dit « à partir de quoi ». Sans lui, on reproduirait exactement le
-- défaut qu'on corrige — un montant sans traçabilité de sa fabrication.
--
-- Nullables, sans DEFAULT : PostgreSQL ne réécrit pas la table.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "token_casefiles"
  ADD COLUMN IF NOT EXISTS "insiderExitNotionalValueUsd"       bigint;
ALTER TABLE "token_casefiles"
  ADD COLUMN IF NOT EXISTS "insiderExitNotionalValueUsdNature" "DataNature";
ALTER TABLE "token_casefiles"
  ADD COLUMN IF NOT EXISTS "insiderExitNotionalBasis"          jsonb;

-- ─── VÉRIFICATION ─────────────────────────────────────────────────────────
SELECT column_name, data_type, udt_name, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_name = 'token_casefiles'
   AND column_name LIKE 'insiderExitNotional%'
 ORDER BY column_name;
-- ATTENDU : 3 lignes, is_nullable = YES, column_default = NULL sur les trois.
--   insiderExitNotionalBasis          · jsonb
--   insiderExitNotionalValueUsd       · bigint
--   insiderExitNotionalValueUsdNature · USER-DEFINED / DataNature

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- ALTER TABLE "token_casefiles" DROP COLUMN IF EXISTS "insiderExitNotionalBasis";
-- ALTER TABLE "token_casefiles" DROP COLUMN IF EXISTS "insiderExitNotionalValueUsdNature";
-- ALTER TABLE "token_casefiles" DROP COLUMN IF EXISTS "insiderExitNotionalValueUsd";
