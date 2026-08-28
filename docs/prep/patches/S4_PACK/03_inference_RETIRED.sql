-- ═══════════════════════════════════════════════════════════════════════════
-- S4 · FICHIER 3/6 — RETIRÉ. JAMAIS EXÉCUTÉ. NE PAS EXÉCUTER.
--
--        ┌──────────────────────────────────────────────────────────┐
--        │  RETIRED — OPTION C étendue à sxyz500_hops.json           │
--        │  Ce fichier est conservé comme RECORD d'une décision,     │
--        │  pas comme une migration en attente.                      │
--        └──────────────────────────────────────────────────────────┘
--
-- Ce fichier proposait de classer sxyz500_hops.json en INFERENCE. Il n'a
-- jamais été passé en base : le founder l'a sauté à l'exécution du 2026-08-28,
-- et l'arbitrage a ensuite ÉTENDU OPTION C à cette pièce.
--
-- ─── POURQUOI ────────────────────────────────────────────────────────────
-- La réserve écrite dans ce fichier avant exécution s'est révélée décisive :
-- les 6 entrées de sxyz500_hops.json portent TOUTES un champ « _note » rédigé
-- à la main — p. ex. « Dad wallet — received supply on BOTIFY + GHOST, sold.
-- Real KolWallet. » Des affirmations éditoriales logées dans un artefact
-- calculé : c'est la définition même d'un artefact à affirmations mixtes.
--
-- Le critère qui avait sorti BOTIFY_KOL_SCAN_REPORT.json s'applique donc ici
-- à l'identique. La pièce rejoint l'ensemble MIXED_ASSERTION_ARTIFACT du
-- fichier 06, qui passe de 33 à 34 pièces.
--
-- ─── CONSÉQUENCE SUR LE PACK ─────────────────────────────────────────────
-- INFERENCE n'est écrit NULLE PART par S4. Comme THIRD_PARTY_DATA et ESTIMATE,
-- la valeur reste à zéro sur EvidenceItem — non par oubli, mais parce que
-- chaque artefact qui aurait pu la porter s'est révélé mixte à la lecture.
-- C'est un résultat de fond : le corpus probatoire du produit ne contient
-- presque aucun document mono-nature en dehors des captures d'écran.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── L'UPDATE QUI N'A JAMAIS TOURNÉ — NEUTRALISÉ ─────────────────────────
-- Laissé en commentaire, et en commentaire seulement : un copier-coller
-- distrait de ce fichier ne doit rien pouvoir écrire.
--
-- UPDATE "EvidenceItem" SET "rowNature" = 'INFERENCE'
--  WHERE "rowNature" = 'UNCLASSIFIED'
--    AND "sha256" = '9cc752c6584d8c2e1dbc2863e9ec7414a2e5db9a781f8e866716c48fa83d2407';
--                                                                -- jamais exécuté

-- ─── CONTRÔLE — lecture seule, prouve que le fichier n'a pas tourné ──────
SELECT "filePath", COALESCE("rowNature"::text,'(NULL)') AS nature,
       COALESCE("evidentiaryStatus",'(NULL)')           AS statut
  FROM "EvidenceItem"
 WHERE "sha256" = '9cc752c6584d8c2e1dbc2863e9ec7414a2e5db9a781f8e866716c48fa83d2407';
-- ATTENDU : sxyz500_hops.json · UNCLASSIFIED · (NULL)
-- Si nature = INFERENCE, le fichier a été exécuté par erreur : le rollback est
-- l'UPDATE inverse, gardé sur ce même sha256.
