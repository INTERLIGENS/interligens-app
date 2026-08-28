-- ═══════════════════════════════════════════════════════════════════════════
-- S4 · FICHIER 4/6 — MARQUEUR DE CONFIANCE TEMPORELLE · 1 070 lignes
--
-- ─── LA DOCTRINE, RATIFIÉE — TROIS AXES QU'ON NE MÉLANGE JAMAIS ──────────
--     nature         = ce qu'EST l'acte dont la ligne est le produit
--     timestampMode  = la QUALITÉ et l'ORIGINE de la datation
--     confiance      = la CONSÉQUENCE des deux, jamais une donnée en soi
-- Une capture mal datée reste une observation primaire : sa faiblesse se lit
-- sur le deuxième axe, jamais en dégradant le premier.
--
-- R2 exige donc que la faiblesse temporelle soit portée AILLEURS que dans la
-- nature. Le schéma le permet : la colonne "timestampMode" (text) existe déjà
-- et porte un vocabulaire vivant — 'retroactive' sur les 32 PDF,
-- 'at-ingestion' sur les 2 captures de première main. AUCUN DDL n'est requis.
--
-- Ce fichier ne fait que PROMOUVOIR EN COLONNE un fait déjà déclaré en texte
-- libre dans "notes". Il n'invente aucune information : chaque valeur écrite
-- est la reformulation d'une mention déjà présente sur la ligne, vérifiée par
-- prédicat. Rien n'est déduit.
--
-- ⚠️ CE FICHIER EST INDÉPENDANT DE L'ORDRE. Ses prédicats ne lisent JAMAIS
-- "rowNature" : ils portent sur "captureTool" et sur "timestampMode" IS NULL.
-- Il peut donc s'exécuter avant ou après les fichiers 01-03 sans changer de
-- résultat. Un garde sur rowNature='UNCLASSIFIED' aurait produit 0 écriture
-- si le fichier 01 était passé d'abord — piège évité délibérément.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Les 145 lignes de backfill — date approximée par l'historique git ─
-- Mesuré : les 145 lignes de captureTool='backfill' portent TOUTES dans leurs
-- notes « capturedAt=commit git … ; vraie date de capture inconnue » (145/145,
-- zéro exception). La date stockée n'est pas la date de capture : c'est la
-- date d'un commit, utilisée comme approximation supérieure.
--
-- C'est exactement le marqueur ratifié : « capture timestamp unknown /
-- approximated from repository history ».
UPDATE "EvidenceItem" SET "timestampMode" = 'approximated-from-repo-history'
 WHERE "timestampMode" IS NULL
   AND "captureTool" = 'backfill';                                  -- attendu : 145

-- ─── 2. Les 925 lignes migrées — horodatage rétroactif déclaratif ────────
-- Leur notes porte déjà « [TIMESTAMP:RETROACTIVE] horodatage rétroactif —
-- capturedAt déclarative (observedAt source), seule l'existence du hash au
-- stamping est prouvée ». La valeur 'retroactive' existe déjà dans la colonne
-- (les 32 PDF la portent) : on réutilise le vocabulaire, on n'en crée pas.
--
-- Leur dégradation n'est PAS la même que celle des 145 ci-dessus : ici la date
-- vient d'un observedAt déclaré à la source, pas d'un commit git. Deux
-- faiblesses différentes, deux valeurs différentes. Les confondre reviendrait
-- à faire, sur l'axe temporel, l'erreur d'UPDATE global qu'on refuse partout.
UPDATE "EvidenceItem" SET "timestampMode" = 'retroactive'
 WHERE "timestampMode" IS NULL
   AND "captureTool" = 'migrate-snapshots';                         -- attendu : 925

-- ─── VÉRIFICATION ─────────────────────────────────────────────────────────
SELECT COALESCE("timestampMode",'(NULL)') AS mode,
       COALESCE("captureTool",'(null)')   AS outil, count(*)::int AS n
  FROM "EvidenceItem" GROUP BY 1,2 ORDER BY 3 DESC;
-- ATTENDU :
--   retroactive                    · migrate-snapshots · 925
--   approximated-from-repo-history · backfill          · 145
--   retroactive                    · (null)            ·  32   (PDF, inchangés)
--   at-ingestion                   · osint-vision-commit ·  2   (S3, inchangées)
--   AUCUN (NULL) restant.

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- Ne touche PAS les 32 PDF ni les 2 captures de première main : le prédicat
-- exclut leur captureTool.
-- UPDATE "EvidenceItem" SET "timestampMode" = NULL
--  WHERE "captureTool" IN ('backfill','migrate-snapshots');
