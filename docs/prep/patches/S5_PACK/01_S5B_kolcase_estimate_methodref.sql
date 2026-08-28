-- ═══════════════════════════════════════════════════════════════════════════
-- S5-B · les 7 KolCase CHIFFRÉES : nature + référence de méthode · 7 lignes
--        DÉPEND DU FICHIER 00 (colonne rowNature).
--
-- ─── PRÉREQUIS DUR : S5-A DOIT ÊTRE MERGÉ ────────────────────────────────
-- Vérifier que main porte content/methodologies/financial-estimates/v1.md
-- avec status: FROZEN et
--   contentSha256: 078be1574cd15dea17d4b07cc6fb5de77f166646270350ae16fe90969601cdf2
-- Sans artefact gelé, on remplace un pointeur mouvant par un autre.
--
-- ─── PÉRIMÈTRE : LES LIGNES QUI PORTENT UN CHIFFRE ───────────────────────
-- 7 lignes : claimType='analytical_estimate' ET paidUsd IS NOT NULL.
--
--     ravedao      RAVE-DUMP-APR2026  insider       48 300 000 $
--     bkokoski     SERIAL-12RUGS      promoter       3 200 000 $
--     bkokoski     BOTIFY             dev              850 000 $
--     GordonGekko  BOTIFY             co_promoter      800 000 $
--     sxyz500      BOTIFY             dev              600 000 $
--     bkokoski     GHOST              dev              320 000 $
--     sxyz500      GHOST              dev              280 000 $
--
-- Les 3 lignes SANS montant sont hors de ce fichier : elles n'estiment rien,
-- et leur donner une méthode d'estimation serait une fausse référence. Elles
-- passent en INFERENCE par le fichier 03.
--
-- ─── CE QUI CHANGE ───────────────────────────────────────────────────────
--   rowNature       (absente)         → ESTIMATE
--   methodologyRef  '/en/methodology' → 'financial-estimates/est-proceeds@v1'
--                   une ROUTE            un COMPOSANT d'artefact GELÉ
--
-- La route ne disait pas LAQUELLE des 7 rubriques fondait le chiffre, et rien
-- n'empêchait sa réécriture sous les montants qu'elle justifie.
--
-- ─── CE QUE CETTE ÉCRITURE DÉCLARE, ET CE QU'ELLE NE DÉCLARE PAS ─────────
-- Elle déclare que est-proceeds@v1 S'APPLIQUE à ces chiffres. Elle ne prouve
-- PAS qu'elle a été SUIVIE : aucune trace de calcul, aucun versionNote, aucun
-- jeu de transactions référencé n'existe sur ces lignes. L'établir exigerait
-- de recalculer les 7 montants — chantier d'instruction, pas migration.
-- Écrit ici pour que personne ne lise cette référence comme une preuve.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE "KolCase"
   SET "rowNature"      = 'ESTIMATE',
       "methodologyRef" = 'financial-estimates/est-proceeds@v1'
 WHERE "rowNature" IS NULL
   AND "claimType" = 'analytical_estimate'
   AND "paidUsd" IS NOT NULL;                                       -- attendu : 7

-- Garde par rowNature IS NULL : rejouable, et le second passage ne trouve rien.

-- ─── VÉRIFICATION ─────────────────────────────────────────────────────────
SELECT "claimType",
       COALESCE("rowNature"::text,'(NULL)')  AS nature,
       COALESCE("methodologyRef",'(NULL)')   AS ref,
       count(*)::int AS n, count("paidUsd")::int AS avec_montant
  FROM "KolCase" GROUP BY 1,2,3 ORDER BY 4 DESC;
-- ATTENDU APRÈS CE SEUL FICHIER :
--   analytical_estimate · ESTIMATE · financial-estimates/est-proceeds@v1 · 7 · 7
--   analytical_estimate · (NULL)   · /en/methodology                     · 3 · 0
--   source_attributed   · (NULL)   · /en/methodology                     · 1 · 1
-- STOP si une ligne ESTIMATE apparaît sans montant : le prédicat a débordé.

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- UPDATE "KolCase"
--    SET "rowNature" = NULL, "methodologyRef" = '/en/methodology'
--  WHERE "methodologyRef" = 'financial-estimates/est-proceeds@v1';
