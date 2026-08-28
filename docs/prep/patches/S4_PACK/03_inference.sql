-- ═══════════════════════════════════════════════════════════════════════════
-- S4 · FICHIER 3/6 — INFERENCE · 1 ligne
--
-- Une seule sortie calculée est classée ici. Le lot REPO_ARTIFACT en compte 3,
-- et les trois partent dans trois directions différentes :
--
--   sxyz500_hops.json           → INFERENCE          (ce fichier)
--   INDEX.json                  → EDITORIAL_ASSERTION (fichier 02)
--   BOTIFY_KOL_SCAN_REPORT.json → reste UNCLASSIFIED  (fichier 06, OPTION C)
--
-- D'où des prédicats par sha256, jamais un UPDATE sur
-- sourceType='REPO_ARTIFACT' — qui aurait emporté les trois d'un coup et
-- classé de force un artefact que l'arbitrage a explicitement mis de côté.
-- C'est la leçon MmClaimType.FACT, appliquée sur 3 lignes.
-- ═══════════════════════════════════════════════════════════════════════════

-- sxyz500_hops.json — graphe de 6 sauts entre portefeuilles ; hopIndex,
-- amountUsd et protocol sont dérivés de lectures on-chain agrégées.
UPDATE "EvidenceItem" SET "rowNature" = 'INFERENCE'
 WHERE "rowNature" = 'UNCLASSIFIED'
   AND "sha256" = '9cc752c6584d8c2e1dbc2863e9ec7414a2e5db9a781f8e866716c48fa83d2407';
                                                                    -- attendu : 1

-- ⚠️ RÉSERVE ÉCRITE — FAIT NOUVEAU, POSTÉRIEUR À L'ARBITRAGE.
-- Vérifié le 2026-08-28 en ouvrant le fichier : ses 6 entrées portent TOUTES
-- un champ « _note » rédigé à la main — p. ex. « Dad wallet — received supply
-- on BOTIFY + GHOST, sold. Real KolWallet. » Ce sont des affirmations
-- éditoriales logées dans un artefact calculé.
--
-- Par le critère qui a sorti BOTIFY_KOL_SCAN_REPORT.json (artefact à
-- affirmations mixtes), ce fichier relève du MÊME sursis. L'arbitrage a nommé
-- BOTIFY explicitement et n'avait pas cette mesure sous les yeux : la règle est
-- appliquée telle qu'elle a été rendue, et le fait est écrit ici plutôt que
-- masqué.
--
-- Si l'arbitrage étend OPTION C à ce fichier : NE PAS EXÉCUTER ce fichier 03.
-- Il ne contient qu'un seul UPDATE et se retire sans toucher au reste du pack.
-- Aucune autre étape n'en dépend.

-- ─── VÉRIFICATION ─────────────────────────────────────────────────────────
SELECT "filePath", "rowNature"::text FROM "EvidenceItem"
 WHERE "rowNature" = 'INFERENCE' ORDER BY "filePath";
-- ATTENDU : exactement 1 ligne — sxyz500_hops.json.
-- Si BOTIFY_KOL_SCAN_REPORT.json ou INDEX.json apparaît ici : ARRÊT, un
-- prédicat a débordé.

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- UPDATE "EvidenceItem" SET "rowNature" = 'UNCLASSIFIED'
--  WHERE "rowNature" = 'INFERENCE';
