-- ═══════════════════════════════════════════════════════════════════════════
-- S6-1 · le DEFAULT qui fabriquait des références stale · 0 ligne réécrite
--
-- Mesuré : KolCase.methodologyRef porte DEFAULT '/en/methodology'::text.
-- W2 a corrigé 7 lignes ; le DEFAULT, lui, continuait d'en produire une
-- nouvelle à chaque insertion. Corriger les données sans fermer la source,
-- c'est vider une baignoire dont le robinet coule.
--
-- Conséquence directe sur le CHECK du fichier 01 : sans ce DROP, une contrainte
-- « methodologyRef IS NOT NULL » serait satisfaite d'office par une route
-- morte. Le garde passerait, et ne garderait rien.
--
-- ⚠️ AUCUNE RÉÉCRITURE. Les 4 lignes qui portent encore '/en/methodology'
-- restent inchangées — 3 INFERENCE sans montant (dont aucune n'est une
-- estimation) et la 11e ligne source_attributed, dont S5-E a établi que sa
-- référence porte un consumer réel (checkPublishability). Ce fichier ferme le
-- robinet ; il ne touche pas à l'eau déjà dans la baignoire.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── INVENTAIRE AVANT — à lire, puis à conserver ──────────────────────────
SELECT COALESCE("methodologyRef",'(NULL)')      AS ref,
       COALESCE("rowNature"::text,'(NULL)')     AS nature,
       count(*)::int                            AS n,
       count("paidUsd")::int                    AS chiffrees
  FROM "KolCase" GROUP BY 1,2 ORDER BY 3 DESC;
-- ATTENDU (mesuré le 2026-08-29) :
--   financial-estimates/est-proceeds@v1 · ESTIMATE  · 7 · 7   ← canoniques
--   /en/methodology                     · INFERENCE · 3 · 0   ← legacy, sans montant
--   /en/methodology                     · (NULL)    · 1 · 1   ← la 11e, consumer réel

ALTER TABLE "KolCase" ALTER COLUMN "methodologyRef" DROP DEFAULT;

-- ─── VÉRIFICATION ─────────────────────────────────────────────────────────
SELECT column_name, column_default
  FROM information_schema.columns
 WHERE table_name = 'KolCase' AND column_name = 'methodologyRef';
-- ATTENDU : column_default = NULL.
-- Et l'inventaire ci-dessus doit rendre EXACTEMENT les mêmes comptes qu'avant :
-- 7 / 3 / 1. Toute variation = une écriture non prévue a eu lieu → ARRÊT.

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- ALTER TABLE "KolCase" ALTER COLUMN "methodologyRef" SET DEFAULT '/en/methodology';
