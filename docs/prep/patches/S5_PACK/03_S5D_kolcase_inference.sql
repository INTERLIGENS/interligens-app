-- ═══════════════════════════════════════════════════════════════════════════
-- S5-D · les 3 KolCase SANS montant ne sont pas des estimations · 3 lignes
--        DÉPEND DU FICHIER 00 (colonne rowNature).
--
-- ─── LE RAISONNEMENT ─────────────────────────────────────────────────────
-- Une ESTIMATE implique un chiffre estimé. Ces trois lignes portent
-- claimType='analytical_estimate' et paidUsd = NULL : elles n'estiment rien.
-- Le nom legacy du claimType ne dicte pas la nature.
--
-- Ce qu'elles affirment réellement : que ce KOL a tenu CE RÔLE dans CE CAS —
-- une conclusion tirée du dossier, sans chiffre. C'est une INFERENCE.
--
--     DonWedge    · BOTIFY · co_promoter
--     GordonGekko · GHOST  · co_promoter
--     planted     · GHOST  · co_promoter
--
-- ─── AUCUNE FAUSSE methodRef ─────────────────────────────────────────────
-- Ce fichier n'écrit PAS de methodologyRef. est-proceeds@v1 est une méthode
-- d'ESTIMATION : l'attacher à une ligne qui n'estime rien serait exactement la
-- fausse référence que S5 combat.
--
-- Ces 3 lignes conservent donc leur valeur actuelle, '/en/methodology' —
-- héritée du DEFAULT de la colonne (voir README, finding DN-F3). C'est une
-- référence stale, mais AUCUN consumer n'en dépend : checkPublishability ne
-- déclenche que si paidUsd est renseigné, et ces lignes n'en ont pas. La
-- nettoyer est possible sans risque ; elle n'est pas nettoyée ici parce que
-- l'arbitrage ne l'a pas demandé, et qu'on ne supprime pas à l'aveugle.
-- Point porté à ratification.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE "KolCase" SET "rowNature" = 'INFERENCE'
 WHERE "rowNature" IS NULL
   AND "claimType" = 'analytical_estimate'
   AND "paidUsd" IS NULL;                                           -- attendu : 3

-- ─── VÉRIFICATION ─────────────────────────────────────────────────────────
SELECT "claimType", COALESCE("rowNature"::text,'(NULL)') AS nature,
       COALESCE("methodologyRef",'(NULL)') AS ref,
       count(*)::int AS n, count("paidUsd")::int AS avec_montant
  FROM "KolCase" GROUP BY 1,2,3 ORDER BY 4 DESC;
-- ATTENDU, ÉTAT FINAL DE LA TABLE (11 lignes) :
--   analytical_estimate · ESTIMATE  · financial-estimates/est-proceeds@v1 · 7 · 7
--   analytical_estimate · INFERENCE · /en/methodology                     · 3 · 0
--   source_attributed   · (NULL)    · /en/methodology                     · 1 · 1
-- STOP si une ligne INFERENCE porte un montant.
--
-- La 11e ligne garde sa référence ET reste sans nature : S5-E l'a examinée,
-- son methodologyRef porte un consumer réel (checkPublishability, sur paidUsd),
-- et aucune nature n'a été prononcée sur elle.

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- UPDATE "KolCase" SET "rowNature" = NULL WHERE "rowNature" = 'INFERENCE';
