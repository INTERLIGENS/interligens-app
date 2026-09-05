-- ═══════════════════════════════════════════════════════════════════════════
-- W2 · FICHIER 1/3 — le montant rejoint le champ qui le décrit · 1 ligne
--        DÉPEND DU FICHIER 00.
--
-- ⚠️ CE FICHIER NE CRÉE AUCUN CHIFFRE. Il déplace un montant existant, à
-- l'octet près : 482 000 000 sort d'une colonne qui le déforme et entre dans
-- une colonne qui le nomme. Rien n'est recalculé, rien n'est arrondi.
--
-- ─── DESCRIPTION CANONIQUE DU CHAMP ──────────────────────────────────────
-- « Valeur notionnelle des 100M LAB attribués à la sortie/transfert
--   d'insiders, valorisés au prix de référence. Ne représente ni des proceeds
--   réalisés ni des pertes retail. »
--
-- ─── LES DEUX ÉTAGES DE NATURE ───────────────────────────────────────────
-- Étage 1 — LA QUANTITÉ. « 100M LAB attribués/tracés à la sortie insiders »
--   est THIRD_PARTY_DATA : l'observation est attribuée à ZachXBT (chronologie
--   du casefile, 11–12 mai 2026 ; champ sources, 14 mai). Ce n'est PAS une
--   observation primaire d'INTERLIGENS.
--
-- Étage 2 — LA VALORISATION. « 100M LAB × ~4,82 $ ≈ 482 M$ » est une ESTIMATE :
--   une valorisation notionnelle dérivée. C'est elle que porte la colonne, et
--   c'est pourquoi sa nature vaut ESTIMATE et non THIRD_PARTY_DATA — la
--   multiplication est notre opération, même si son entrée ne l'est pas.
--
-- Le natureBasis écrit ci-dessous rend l'étage 1 relisible depuis l'étage 2.
-- Sans lui, la colonne dirait « estimation » sans dire de quoi.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE "token_casefiles"
   SET "insiderExitNotionalValueUsd"       = "estimatedRetailHarmUsd",
       "insiderExitNotionalValueUsdNature" = 'ESTIMATE',
       "insiderExitNotionalBasis"          = jsonb_build_object(
     'description',   'Valeur notionnelle des 100M LAB attribués à la sortie/transfert d''insiders, valorisés au prix de référence. Ne représente ni des proceeds réalisés ni des pertes retail.',
     'formula',       'tokenQuantity × referencePriceUsd',
     'tokenQuantity', jsonb_build_object(
        'value',      100000000,
        'unit',       'LAB',
        'nature',     'THIRD_PARTY_DATA',
        'attributedTo','ZachXBT',
        'event',      'Retrait de 100M LAB depuis Bitget vers 10 wallets neufs en 12 h',
        'observedWindow', '2026-05-11/2026-05-12',
        'sourceNote', 'token_casefiles.sources — @zachxbt, 2026-05-14, « Loan agreement + OTC pitch + 100M LAB exit traced »'),
     'referencePrice', jsonb_build_object(
        'value',      4.82,
        'unit',       'USD/LAB',
        'derivation', 'Prix implicite : 482 000 000 / 100 000 000. Non mesuré indépendamment.',
        'window',     '2026-05-11/2026-05-12',
        'corroboration','Fourchette documentée par le casefile pour la période : sortie insiders ~4,00–6,70 $ ; ATH 6,70 $.'),
     'excludesMethodRef', jsonb_build_array(
        'financial-estimates/est-proceeds@v1 — NON applicable : son composant realized-unrealized exclut le non-réalisé, et un retrait vers des wallets neufs est un transfert sans flux de valeur en regard.',
        'financial-estimates/est-investor-losses@v1 — NON applicable : il mesure la valeur des tokens achetés par des wallets NON-insiders, autre grandeur et autre population.'),
     'floatCaveat',  'La quantité représente ~131 % du flottant référencé (76,5 M LAB en circulation). Elle n''aurait pas pu être liquidée au prix spot cité sans impact de marché substantiel.',
     'recordedBy',   'W2 correction tracée, 2026-08-29',
     'supersedes',   'token_casefiles.estimatedRetailHarmUsd — le montant y était rangé sous une affirmation qu''il ne soutient pas'
   )
 WHERE "ref" = 'IL-PND-LAB-001'
   AND "insiderExitNotionalValueUsd" IS NULL
   AND "estimatedRetailHarmUsd" IS NOT NULL;                        -- attendu : 1

-- ─── VÉRIFICATION — le montant est intact et la traçabilité est lisible ──
SELECT "ref", "ticker",
       "estimatedRetailHarmUsd"      AS ancien_champ,
       "insiderExitNotionalValueUsd" AS nouveau_champ,
       "insiderExitNotionalValueUsdNature"::text AS nature,
       "insiderExitNotionalBasis"->'tokenQuantity'->>'nature'       AS nature_quantite,
       "insiderExitNotionalBasis"->'tokenQuantity'->>'attributedTo' AS attribue_a
  FROM "token_casefiles" WHERE "ref" = 'IL-PND-LAB-001';
-- ATTENDU : ancien_champ = 482000000, nouveau_champ = 482000000 (identiques —
-- le fichier 02 n'a pas encore tourné), nature = ESTIMATE,
-- nature_quantite = THIRD_PARTY_DATA, attribue_a = ZachXBT.
-- STOP si nouveau_champ <> ancien_champ : le montant a été altéré au passage.

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- UPDATE "token_casefiles"
--    SET "insiderExitNotionalValueUsd" = NULL,
--        "insiderExitNotionalValueUsdNature" = NULL,
--        "insiderExitNotionalBasis" = NULL
--  WHERE "ref" = 'IL-PND-LAB-001';
