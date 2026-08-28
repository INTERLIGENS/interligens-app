-- ═══════════════════════════════════════════════════════════════════════════
-- S5-C · les 29 KolWallet ne sont pas nos estimations · 29 lignes
--        DÉPEND DU FICHIER 00 (colonne rowNature).
--
-- ─── LE FAIT ─────────────────────────────────────────────────────────────
-- Les 29 lignes claimType='analytical_estimate' sont toutes sur
-- kolHandle='deployer_pool', créées le 2026-03-22 en moins d'une seconde
-- (import de masse). Leur sourceLabel est sans ambiguïté :
--
--     « @dethective — winrate 29.77% »
--
-- et leur label porte les chiffres du même tiers :
--     « Deployer — 7177 tokens — PnL $889 101 — best: Sus »
--
-- Ces PnL et winrates ne sortent PAS de notre pipeline. Sous R1 — la nature
-- qualifie l'acte — l'acte est un RELAIS DE DONNÉE TIERCE, pas un calcul.
--
-- ─── POURQUOI PAS UN methodRef ───────────────────────────────────────────
-- Leur en donner un reviendrait à s'attribuer une méthode qu'on n'a jamais
-- exécutée. C'est exactement la fausse methodRef que la doctrine interdit,
-- sous un nom plus flatteur que « legacy ». D'où : AUCUNE colonne de méthode
-- n'est ajoutée à KolWallet (fichier 00), et aucune référence n'est écrite.
--
-- ─── LA MÉTHODE MAISON LES EXCLUT DÉJÀ ───────────────────────────────────
-- financial-estimates@v1, composant inclusions-exclusions :
--   « Only wallets with documented on-chain linkage (verified or
--     source-attributed) are included in financial calculations. Wallets
--     classified as provisional or heuristically linked are excluded from
--     primary figures. »
-- Or les 29 portent attributionStatus='review' et isPubliclyUsable=false.
-- Les étiqueter ESTIMATE affirmait qu'elles sortaient d'un calcul dont la
-- méthode elle-même les exclut.
--
-- ─── CE QUI N'EST PAS TOUCHÉ, DÉLIBÉRÉMENT ───────────────────────────────
-- claimType, attributionStatus='review', isPubliclyUsable=false, et l'absence
-- de sourceUrl restent INCHANGÉS. Ce sont des dimensions distinctes de la
-- nature : le statut de revue n'est pas une nature, la publiabilité non plus,
-- et un lien manquant reste manquant. Le déclassement rend ce dernier manque
-- VISIBLE — il ne le comble pas.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE "KolWallet" SET "rowNature" = 'THIRD_PARTY_DATA'
 WHERE "rowNature" IS NULL
   AND "claimType" = 'analytical_estimate';                         -- attendu : 29

-- ─── VÉRIFICATION ─────────────────────────────────────────────────────────
SELECT "claimType", COALESCE("rowNature"::text,'(NULL)') AS nature,
       count(*)::int AS n, count("sourceUrl")::int AS avec_url
  FROM "KolWallet" GROUP BY 1,2 ORDER BY 3 DESC;
-- ATTENDU sur la ligne visée :
--   analytical_estimate · THIRD_PARTY_DATA · 29 · 0
-- Les 453 autres lignes gardent rowNature = (NULL) : aucune nature n'a été
-- prononcée sur elles, et on n'en invente pas pour finir la colonne.
-- avec_url = 0 est le constat, pas un effet de bord : aucune des 29 ne porte
-- de lien vers la publication d'origine de @dethective.

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- UPDATE "KolWallet" SET "rowNature" = NULL
--  WHERE "rowNature" = 'THIRD_PARTY_DATA' AND "claimType" = 'analytical_estimate';
