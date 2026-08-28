-- ═══════════════════════════════════════════════════════════════════════════
-- S4 · FICHIER 6/6 — ARTEFACTS À AFFIRMATIONS MIXTES · ZÉRO ÉCRITURE
--
--        ROW-LEVEL MODEL INSUFFICIENT FOR MIXED-ASSERTION ARTIFACT
--
-- ⚠️ CE FICHIER N'ÉCRIT RIEN. Aucun UPDATE actif, aucun DDL actif. Il est dans
-- le pack pour que le manque soit VISIBLE À L'EXÉCUTION, pas rangé dans un
-- document annexe qu'on ne rouvre jamais.
--
-- ─── PÉRIMÈTRE : 33 LIGNES ────────────────────────────────────────────────
--   32  PDF de cas générés            (sourceType = 'GENERATED_CASE_PDF')
--    1  BOTIFY_KOL_SCAN_REPORT.json   (sha256 1608ed3e…)
--
-- ─── OPTION C, RATIFIÉE : ELLES RESTENT UNCLASSIFIED ──────────────────────
-- Ce n'est pas un abandon, c'est le résultat. Un artefact qui porte plusieurs
-- natures ne peut pas être décrit par une colonne qui n'en accepte qu'une. Lui
-- en assigner une serait mentir sur les autres — et « aucun classement forcé
-- pour atteindre 100 % » est une contrainte ferme de l'arbitrage.
--
-- ─── POURQUOI LE MODÈLE ACTUEL NE SUFFIT PAS ──────────────────────────────
-- "rowNature" est UNE colonne, sur UNE ligne, pour UN artefact. Le régime
-- FIELD ne sauve rien : il nomme des CHAMPS DE LA TABLE, et les affirmations
-- d'un rapport ne sont pas des champs — elles sont dans le document, hors du
-- schéma. Aucun des quatre régimes du registre ne décrit un document.
--
-- La règle de classement ratifiée est pourtant claire, et resterait applicable
-- si un porteur existait :
--     calculé / dérivé  → INFERENCE
--     chiffré           → ESTIMATE
--     commentaire       → EDITORIAL_ASSERTION
--
-- Ce qui manque n'est pas la règle. C'est l'endroit où l'écrire.
--
-- ─── LES DEUX CAS, MESURÉS ────────────────────────────────────────────────
-- Les 32 PDF : rapports de cas produits par le produit lui-même. Ils portent
-- des dizaines d'affirmations des trois natures. S'y ajoute une règle qu'aucune
-- colonne ne porte aujourd'hui — la CIRCULARITÉ : un PDF généré par INTERLIGENS
-- n'est JAMAIS preuve primaire de ses propres conclusions. Il est le record de
-- ce qu'INTERLIGENS a conclu et publié à une date, pas une preuve indépendante.
--
-- BOTIFY_KOL_SCAN_REPORT.json : sortie de scan de 41 KOL. Les txCount et
-- totalUsdCashout sont agrégés depuis la chaîne (INFERENCE), mais le fichier
-- porte aussi « solPriceEstimate »: 200 et des « usdDeal » — des ESTIMATE, qui
-- exigeront un methodRef en S5. Deux natures dans un fichier, une colonne.
--
-- ─── CE QUI N'EST PAS FAIT, ET NE DOIT PAS L'ÊTRE MAINTENANT ──────────────
-- Aucune table EvidenceItemAssertion n'est créée. Arbitrage rendu : chantier
-- ULTÉRIEUR. La créer vide n'avancerait rien — le coût réel n'est pas la
-- migration, c'est le DÉPOUILLEMENT : lire 33 documents et énumérer leurs
-- affirmations à la main. Ça ne se code pas.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── DIAGNOSTIC — lecture seule, à exécuter sans risque ───────────────────
SELECT CASE WHEN "sourceType" = 'GENERATED_CASE_PDF' THEN 'PDF de cas genere'
            ELSE 'rapport de scan JSON' END              AS famille,
       COALESCE("timestampMode",'(NULL)')                AS horodatage,
       count(*)::int                                     AS n,
       count("tsaToken")::int                            AS avec_tsa,
       count(*) FILTER (WHERE "rowNature" = 'UNCLASSIFIED')::int AS non_classees
  FROM "EvidenceItem"
 WHERE "sourceType" = 'GENERATED_CASE_PDF'
    OR "sha256" = '1608ed3e9770d328774dc7629f25c009e4cada06234655e390dceb9b46792280'
 GROUP BY 1,2 ORDER BY 3 DESC;
-- ATTENDU : 33 lignes au total, toutes non_classees, dont 32 PDF sans TSA.
-- Si non_classees < n, un fichier de classement a débordé sur ce périmètre :
-- ARRÊT, et rollback du fichier fautif.
