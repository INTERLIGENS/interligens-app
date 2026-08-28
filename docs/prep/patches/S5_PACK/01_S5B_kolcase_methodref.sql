-- ═══════════════════════════════════════════════════════════════════════════
-- S5-B · les 10 KolCase reçoivent une référence de méthode RÉELLE · 10 lignes
--
-- ─── PRÉREQUIS DUR : S5-A DOIT ÊTRE MERGÉ ────────────────────────────────
-- Cette référence ne vaut que si l'artefact qu'elle cite est gelé. Avant de
-- lancer ce fichier, vérifier que main porte :
--     content/methodologies/financial-estimates/v1.md   (status: FROZEN)
--     contentSha256: 078be1574cd15dea17d4b07cc6fb5de77f166646270350ae16fe90969601cdf2
-- Sans ça, on remplace un pointeur mouvant (/en/methodology) par un autre.
--
-- ─── CE QUI CHANGE ───────────────────────────────────────────────────────
--     '/en/methodology'                       (une ROUTE, non versionnée)
--   → 'financial-estimates/est-proceeds@v1'   (un COMPOSANT d'artefact gelé)
--
-- La route ne disait pas LAQUELLE des 7 rubriques fondait le chiffre, et rien
-- n'empêchait sa réécriture sous les montants qu'elle justifie. La nouvelle
-- référence nomme le composant et fige la version.
--
-- ─── CE QUE CETTE ÉCRITURE DÉCLARE, ET CE QU'ELLE NE DÉCLARE PAS ─────────
-- Elle déclare que la méthode est-proceeds@v1 S'APPLIQUE à ces chiffres.
-- Elle ne prouve PAS qu'elle a été SUIVIE : aucune trace de calcul, aucun
-- versionNote, aucun jeu de transactions référencé n'existe sur ces lignes.
-- Établir qu'elle a été appliquée exigerait de recalculer les 7 montants —
-- c'est un chantier d'instruction, pas une migration. Écrit ici pour que
-- personne ne lise cette référence comme une preuve de calcul.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE "KolCase"
   SET "methodologyRef" = 'financial-estimates/est-proceeds@v1'
 WHERE "claimType" = 'analytical_estimate'
   AND "methodologyRef" = '/en/methodology';                        -- attendu : 10

-- Garde par la valeur ACTUELLE, pas par IS NULL : la colonne n'est jamais
-- vide ici. Relancer le fichier ne trouve plus rien — rejouable.
--
-- La 11e ligne (planted/BOTIFY, claimType='source_attributed') n'est PAS
-- visée : elle n'est pas une estimation, et est-proceeds@v1 est une méthode
-- d'ESTIMATION. Lui coller cette référence serait le mensonge que S5 combat.
-- Voir S5-E : sa référence est conservée en l'état, elle porte un consumer réel.

-- ─── VÉRIFICATION ─────────────────────────────────────────────────────────
SELECT COALESCE("methodologyRef",'(NULL)') AS ref, "claimType",
       count(*)::int AS n, count("paidUsd")::int AS avec_montant
  FROM "KolCase" GROUP BY 1,2 ORDER BY 3 DESC;
-- ATTENDU :
--   financial-estimates/est-proceeds@v1 · analytical_estimate · 10 · 7
--   /en/methodology                     · source_attributed   ·  1 · 1
--
-- ⚠️ LA COLONNE PORTE DÉSORMAIS DEUX VOCABULAIRES. C'est voulu et transitoire :
-- 10 références canoniques et 1 route legacy conservée pour son consumer. Ne
-- pas « uniformiser » la 11e sans l'arbitrage S5-E.

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- UPDATE "KolCase" SET "methodologyRef" = '/en/methodology'
--  WHERE "methodologyRef" = 'financial-estimates/est-proceeds@v1';
