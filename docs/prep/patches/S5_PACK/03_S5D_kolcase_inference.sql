-- ═══════════════════════════════════════════════════════════════════════════
-- S5-D · les 3 KolCase sans montant ne sont pas des estimations · 3 lignes
--        DÉPEND DU FICHIER 00 (colonne rowNature).
--
-- ─── LE RAISONNEMENT ─────────────────────────────────────────────────────
-- Une ESTIMATE implique un chiffre estimé. Ces trois lignes portent
-- claimType='analytical_estimate' et paidUsd = NULL : elles n'estiment rien.
-- Le nom legacy du claimType ne dicte pas la nature.
--
-- Ce qu'elles affirment réellement : que ce KOL a tenu CE RÔLE dans CE CAS —
-- une conclusion tirée de l'ensemble du dossier, sans chiffre. C'est une
-- INFERENCE.
--
--     DonWedge    · BOTIFY · co_promoter
--     GordonGekko · GHOST  · co_promoter
--     planted     · GHOST  · co_promoter
--
-- ─── LEUR methodologyRef ─────────────────────────────────────────────────
-- Le fichier 01 leur écrit financial-estimates/est-proceeds@v1 comme aux 7
-- autres, l'arbitrage S5-B portant sur les 10. À noter sans le trancher ici :
-- une méthode d'ESTIMATION attachée à une ligne classée INFERENCE se défend
-- (elle décrit ce qui s'appliquera quand un montant sera écrit) mais se
-- discute. Si l'arbitrage préfère les en exclure, le prédicat du fichier 01
-- prend « AND "paidUsd" IS NOT NULL » et rend 7 au lieu de 10.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE "KolCase" SET "rowNature" = 'INFERENCE'
 WHERE "rowNature" IS NULL
   AND "claimType" = 'analytical_estimate'
   AND "paidUsd" IS NULL;                                           -- attendu : 3

-- ─── LES 7 AUTRES NE SONT PAS TOUCHÉES ICI ───────────────────────────────
-- Les 7 KolCase analytical_estimate AVEC montant restent rowNature = NULL.
-- Les passer à ESTIMATE serait cohérent — mais l'arbitrage ne l'a pas
-- prononcé, et « aucune nature fabriquée pour finir » l'emporte sur la
-- symétrie. Point porté à ratification (§9 du doc S5).

-- ─── VÉRIFICATION ─────────────────────────────────────────────────────────
SELECT "claimType", COALESCE("rowNature"::text,'(NULL)') AS nature,
       count("paidUsd")::int AS avec_montant, count(*)::int AS n
  FROM "KolCase" GROUP BY 1,2 ORDER BY 4 DESC;
-- ATTENDU :
--   analytical_estimate · (NULL)    · 7 · 7   ← les 7 chiffrées, non prononcées
--   analytical_estimate · INFERENCE · 0 · 3   ← les 3 sans montant
--   source_attributed   · (NULL)    · 1 · 1   ← la 11e, hors périmètre S5-D
-- Si une ligne INFERENCE porte un montant : ARRÊT, le prédicat a débordé.

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- UPDATE "KolCase" SET "rowNature" = NULL WHERE "rowNature" = 'INFERENCE';
