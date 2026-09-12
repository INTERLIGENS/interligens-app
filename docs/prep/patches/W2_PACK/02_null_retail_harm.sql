-- ═══════════════════════════════════════════════════════════════════════════
-- W2 · FICHIER 2/3 — le préjudice retail redevient NON ESTIMÉ · 1 ligne
--        DÉPEND DU FICHIER 01. NE PAS LANCER AVANT.
--
-- ─── CE QUE FAIT CE FICHIER ──────────────────────────────────────────────
-- estimatedRetailHarmUsd passe à NULL sur IL-PND-LAB-001, et sa colonne de
-- nature avec lui. Aucun chiffre de remplacement n'est écrit :
-- « non estimé » est la réponse honnête aujourd'hui.
--
-- ─── POURQUOI CE N'EST PAS UNE SUPPRESSION ───────────────────────────────
-- Le montant n'est pas détruit : le fichier 01 l'a déjà copié dans
-- insiderExitNotionalValueUsd, et le garde ci-dessous REFUSE de vider l'ancien
-- champ tant que le nouveau n'est pas peuplé. Si le fichier 01 n'a pas tourné,
-- ce fichier écrit 0 ligne — c'est voulu, pas un échec.
--
-- La doctrine « NEVER DELETE » est tenue par déplacement, pas par conservation
-- d'un doublon : garder 482 M$ dans les deux colonnes laisserait la surface
-- publique libre de continuer à lire la mauvaise.
--
-- ─── CE QU'ON N'ÉCRIT PAS, ET POURQUOI ───────────────────────────────────
-- Aucun préjudice retail recalculé. Le calculer exigerait la valeur des tokens
-- achetés par des wallets NON-insiders moins la valeur recouvrée
-- (financial-estimates/est-investor-losses@v1) — des données qu'on n'a pas.
-- Inventer un ordre de grandeur « plus prudent » serait refaire la faute
-- d'origine dans l'autre sens.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE "token_casefiles"
   SET "estimatedRetailHarmUsd"       = NULL,
       "estimatedRetailHarmUsdNature" = NULL
 WHERE "ref" = 'IL-PND-LAB-001'
   AND "insiderExitNotionalValueUsd" = 482000000                    -- le garde
   AND "insiderExitNotionalBasis" IS NOT NULL;                      -- attendu : 1

-- ─── VÉRIFICATION — état final de la ligne ────────────────────────────────
SELECT "ref", "ticker",
       COALESCE("estimatedRetailHarmUsd"::text,'(NULL) — non estimé') AS prejudice_retail,
       COALESCE("estimatedRetailHarmUsdNature"::text,'(NULL)')        AS nature_prejudice,
       "insiderExitNotionalValueUsd"                                  AS valeur_notionnelle,
       "insiderExitNotionalValueUsdNature"::text                      AS nature_notionnelle,
       "claimedRaiseUsd", "claimedRaiseUsdNature"::text
  FROM "token_casefiles" WHERE "ref" = 'IL-PND-LAB-001';
-- ATTENDU :
--   prejudice_retail    = (NULL) — non estimé
--   nature_prejudice    = (NULL)
--   valeur_notionnelle  = 482000000
--   nature_notionnelle  = ESTIMATE
--   claimedRaiseUsd     = 1500000 · THIRD_PARTY_DATA   (inchangé)
--
-- STOP si valeur_notionnelle est NULL : le fichier 01 n'a pas tourné, et
-- l'ancien champ aurait été vidé sans destination. Le garde l'empêche, mais
-- vérifier plutôt que faire confiance.

-- ─── CONTRÔLE DE NON-RÉGRESSION — l'autre casefile est intact ────────────
SELECT "ref", COALESCE("estimatedRetailHarmUsd"::text,'(NULL)') AS harm,
       COALESCE("insiderExitNotionalValueUsd"::text,'(NULL)')   AS notional
  FROM "token_casefiles" ORDER BY "ref";
-- ATTENDU : 2 lignes.
--   IL-CONC-BLACKBULL-001 · (NULL) · (NULL)   ← jamais touchée
--   IL-PND-LAB-001        · (NULL) · 482000000

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- UPDATE "token_casefiles"
--    SET "estimatedRetailHarmUsd" = 482000000,
--        "estimatedRetailHarmUsdNature" = 'ESTIMATE'
--  WHERE "ref" = 'IL-PND-LAB-001';
