-- ═══════════════════════════════════════════════════════════════════════════
-- S4 · FICHIER 6/6 — ARTEFACTS À AFFIRMATIONS MIXTES · ZÉRO ÉCRITURE
--
--        ROW-LEVEL MODEL INSUFFICIENT FOR MIXED-ASSERTION ARTIFACT
--
--        Motifs canoniques de l'ensemble :
--            MIXED_ASSERTION_ARTIFACT
--            ROW_LEVEL_MODEL_INSUFFICIENT
--
-- ⚠️ CE FICHIER N'ÉCRIT RIEN. Aucun UPDATE actif, aucun DDL actif. Il est dans
-- le pack pour que le manque soit VISIBLE À L'EXÉCUTION, pas rangé dans un
-- document annexe qu'on ne rouvre jamais.
--
-- ─── PÉRIMÈTRE : 34 PIÈCES ────────────────────────────────────────────────
--   32  PDF de cas générés          (sourceType='GENERATED_CASE_PDF')
--                                   28 reports/GordonGekko/ + 4 reports/deployer_pool/
--    1  BOTIFY_KOL_SCAN_REPORT.json (sha256 1608ed3e…, 10 378 o)
--    1  sxyz500_hops.json           (sha256 9cc752c6…,  1 578 o) — ajoutée
--                                   le 2026-08-28 par extension d'OPTION C,
--                                   voir 03_inference_RETIRED.sql
--
-- ─── LA DOCTRINE, ÉCRITE ──────────────────────────────────────────────────
-- Un EvidenceItem dont les affirmations sont de natures NON HOMOGÈNES reste
-- UNCLASSIFIED jusqu'à classification au niveau ASSERTION. "rowNature" ne
-- force JAMAIS une nature globale sur un document qui n'en a pas une seule.
--
-- UNCLASSIFIED ≠ EXCLUDED. Ces 34 pièces sont dans la chaîne probatoire, elles
-- comptent, elles sont opposables — elles attendent seulement un classement
-- plus fin. Les 7 pièces du fichier 05 portent evidentiaryStatus='EXCLUDED' :
-- elles, ne participent plus aux chaînes de preuve. Deux états, deux colonnes,
-- deux significations. Les confondre ferait disparaître 34 pièces valides.
--
-- ─── POURQUOI LE MODÈLE ACTUEL NE SUFFIT PAS ──────────────────────────────
-- "rowNature" est UNE colonne, sur UNE ligne, pour UN artefact. Le régime
-- FIELD ne sauve rien : il nomme des CHAMPS DE LA TABLE, et les affirmations
-- d'un rapport ne sont pas des champs — elles sont dans le document, hors du
-- schéma. Aucun des quatre régimes du registre ne décrit un document.
--
-- La règle de classement reste applicable le jour où un porteur existera :
--     calculé / dérivé  → INFERENCE
--     chiffré           → ESTIMATE
--     commentaire       → EDITORIAL_ASSERTION
-- Ce qui manque n'est pas la règle. C'est l'endroit où l'écrire.
--
-- ─── LES TROIS FAMILLES, MESURÉES ─────────────────────────────────────────
-- Les 32 PDF : rapports produits par le produit lui-même, portant des dizaines
-- d'affirmations des trois natures. S'y ajoute une règle qu'aucune colonne ne
-- porte — la CIRCULARITÉ : un PDF généré par INTERLIGENS n'est JAMAIS preuve
-- primaire de ses propres conclusions. Il est le record de ce qu'INTERLIGENS a
-- conclu et publié à une date, pas une preuve indépendante.
--
-- BOTIFY_KOL_SCAN_REPORT.json : txCount et totalUsdCashout agrégés depuis la
-- chaîne (INFERENCE), mais aussi « solPriceEstimate »: 200 et des « usdDeal »
-- (ESTIMATE, qui exigeront un methodRef en S5).
--
-- sxyz500_hops.json : hopIndex et amountUsd dérivés de lectures on-chain
-- (INFERENCE), et un « _note » rédigé à la main sur CHACUNE de ses 6 entrées
-- (EDITORIAL_ASSERTION).
--
-- ─── BACKLOG ──────────────────────────────────────────────────────────────
-- Ces 34 pièces sont inscrites au chantier EvidenceItemAssertion :
-- voir BACKLOG_EvidenceItemAssertion.md, dans ce même dossier.
-- Aucune table n'est créée ici — arbitrage rendu : chantier ULTÉRIEUR. Le coût
-- réel n'est pas la migration, c'est le DÉPOUILLEMENT de 34 documents à la
-- main. Ça ne se code pas.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── DIAGNOSTIC 1 — l'ensemble MIXED_ASSERTION_ARTIFACT ──────────────────
-- Prédicat canonique de l'ensemble : non classé ET non exclu.
SELECT CASE WHEN "sourceType" = 'GENERATED_CASE_PDF'
              THEN 'PDF de cas genere · ' || COALESCE(substring("r2Key" from 'reports/([^/]+)/'),'?')
            ELSE 'rapport JSON · ' || COALESCE(substring("filePath" from '([^/]+)$'),'?')
       END                                       AS piece,
       COALESCE("timestampMode",'(NULL)')        AS horodatage,
       count(*)::int                             AS n,
       count("tsaToken")::int                    AS avec_tsa
  FROM "EvidenceItem"
 WHERE "rowNature" = 'UNCLASSIFIED'
   AND "evidentiaryStatus" IS NULL
 GROUP BY 1,2 ORDER BY 3 DESC;
-- ATTENDU : 34 pièces au total —
--   PDF de cas genere · GordonGekko    28   (retroactive, 0 TSA)
--   PDF de cas genere · deployer_pool   4   (retroactive, 0 TSA)
--   rapport JSON · BOTIFY_KOL_SCAN_REPORT.json  1
--   rapport JSON · sxyz500_hops.json            1

-- ─── DIAGNOSTIC 2 — l'invariant UNCLASSIFIED ≠ EXCLUDED ──────────────────
SELECT COALESCE("evidentiaryStatus",'(NULL) — dans la chaine') AS statut,
       count(*)::int AS n
  FROM "EvidenceItem" WHERE "rowNature" = 'UNCLASSIFIED'
 GROUP BY 1 ORDER BY 2 DESC;
-- ATTENDU : (NULL) — dans la chaine  34   ← affirmations mixtes, en attente
--           EXCLUDED                  7   ← hors chaine probatoire
--           Total UNCLASSIFIED        41
-- Si une pièce EXCLUDED tombe dans le lot des 34, ou l'inverse, l'ensemble a
-- été pollué : ARRÊT. Les deux états ne doivent jamais se recouvrir.
