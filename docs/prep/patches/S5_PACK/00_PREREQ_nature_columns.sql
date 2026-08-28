-- ═══════════════════════════════════════════════════════════════════════════
-- S5 · FICHIER 0/4 — PRÉREQUIS DDL · ⚠️ À RATIFIER AVANT EXÉCUTION
--
--        S5-C ET S5-D SONT INÉCRIVABLES SANS CE FICHIER.
--
-- ─── LE BLOCAGE, MESURÉ LE 2026-08-28 ────────────────────────────────────
-- S5-C demande « nature ESTIMATE → THIRD_PARTY_DATA » sur 29 KolWallet.
-- S5-D demande « nature INFERENCE » sur 3 KolCase.
-- Or NI KolWallet NI KolCase ne portent de colonne de nature. Vérifié :
--
--     SELECT table_name, count(*) FROM information_schema.columns
--      WHERE udt_name = 'DataNature' GROUP BY 1;
--       → EvidenceItem 1 · KolTokenInvolvement 2 · KolTokenLink 4
--         TokenPriceTracker 4 · token_casefiles 3     (5 tables, 14 colonnes)
--
-- Le registre classe pourtant KolWallet et KolCase en régime ROW / étape S4 —
-- mais S4 s'est finalement limité à EvidenceItem. Ces deux tables n'ont jamais
-- reçu leur colonne. Le manque n'apparaît qu'ici, parce que S5 est le premier
-- à vouloir y écrire une nature.
--
-- ─── POURQUOI PAS ÉCRIRE DANS claimType ──────────────────────────────────
-- Tentant, et faux. « Le nom legacy ne dicte pas la nature » : claimType est
-- un vocabulaire d'origine ('analytical_estimate', 'source_attributed',
-- 'verified_onchain'…), pas une nature de donnée. L'écraser détruirait la
-- provenance ET casserait checkPublishability (src/lib/kol/types.ts), qui
-- décide de la publiabilité d'un profil en lisant claimType. Deux axes, deux
-- colonnes — la leçon de S4 sur UNCLASSIFIED ≠ EXCLUDED, appliquée ici.
--
-- ─── CE QUE CE FICHIER N'AJOUTE PAS ──────────────────────────────────────
-- AUCUNE colonne de méthode sur KolWallet. C'est explicitement exclu par
-- l'arbitrage S5-C : les 29 lignes relaient un tiers, elles n'ont pas de
-- méthode maison à référencer. Une colonne vide inviterait à la remplir.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "KolWallet" ADD COLUMN IF NOT EXISTS "rowNature" "DataNature";
ALTER TABLE "KolCase"   ADD COLUMN IF NOT EXISTS "rowNature" "DataNature";

-- Nullables, sans DEFAULT : PostgreSQL ne réécrit pas la table, l'opération
-- est instantanée. NULL signifie « aucune nature prononcée », JAMAIS une
-- nature par défaut — même règle qu'en S4.

-- ─── VÉRIFICATION ─────────────────────────────────────────────────────────
SELECT table_name, column_name, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_name IN ('KolWallet','KolCase') AND column_name = 'rowNature'
 ORDER BY 1;
-- ATTENDU : 2 lignes, is_nullable = YES, column_default = NULL.

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- ALTER TABLE "KolWallet" DROP COLUMN IF EXISTS "rowNature";
-- ALTER TABLE "KolCase"   DROP COLUMN IF EXISTS "rowNature";
