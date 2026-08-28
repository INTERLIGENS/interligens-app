-- ═══════════════════════════════════════════════════════════════════════════
-- S6-5 · CHECK token_casefiles — une ESTIMATE porte un basis auditable · 1/1
--
-- ─── POURQUOI UN BASIS ET PAS UN methodRef ───────────────────────────────
-- La seule ESTIMATE de cette table est la valeur notionnelle de sortie (W2), et
-- AUCUNE méthodologie gelée ne la couvre : est-proceeds@v1 est explicitement
-- exclu (son composant realized-unrealized écarte le non-réalisé), et
-- est-investor-losses@v1 mesure une autre grandeur sur une autre population.
--
-- Exiger un methodRef ici pousserait à en inventer un — exactement ce que W2
-- interdit. La colonne n'en porte d'ailleurs aucune : le seul porteur
-- d'auditabilité de cette table est insiderExitNotionalBasis.
--
-- ─── PORTÉE VOLONTAIREMENT ÉTROITE ───────────────────────────────────────
-- Le CHECK ne vise QUE insiderExitNotionalValueUsdNature. Les autres colonnes
-- de nature de la table — claimedRaiseUsdNature, estimatedRetailHarmUsdNature,
-- rowNature — n'ont AUCUN porteur d'auditabilité. Les inclure interdirait une
-- ESTIMATE légitime future faute de colonne pour la justifier : c'est le genre
-- de contrainte qui finit désactivée, et une contrainte désactivée est pire
-- qu'une contrainte absente.
--
-- En particulier estimatedRetailHarmUsd, aujourd'hui NULL : le jour où un vrai
-- préjudice retail sera calculé via est-investor-losses@v1, il lui faudra son
-- propre porteur, et son propre CHECK.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "token_casefiles"
  ADD CONSTRAINT "token_casefiles_notional_estimate_requires_basis"
  CHECK (
    "insiderExitNotionalValueUsdNature" IS DISTINCT FROM 'ESTIMATE'
    OR (
         "insiderExitNotionalBasis" IS NOT NULL
     AND jsonb_typeof("insiderExitNotionalBasis") = 'object'
     AND "insiderExitNotionalBasis" <> '{}'::jsonb
    )
  ) NOT VALID;

-- Le `<> '{}'` n'est pas du zèle : un objet vide passerait IS NOT NULL et
-- jsonb_typeof sans rien auditer. Le garde applicatif refuse la même chose
-- (assertEstimateAuditable exige au moins une clé) — les deux disent la même
-- règle, et un test le vérifie.

-- ─── POST-CHECK — à lire AVANT de valider ────────────────────────────────
SELECT count(*) FILTER (WHERE "insiderExitNotionalValueUsdNature" = 'ESTIMATE')  AS estimates,
       count(*) FILTER (WHERE "insiderExitNotionalValueUsdNature" = 'ESTIMATE'
                          AND "insiderExitNotionalBasis" IS NOT NULL
                          AND jsonb_typeof("insiderExitNotionalBasis") = 'object'
                          AND "insiderExitNotionalBasis" <> '{}'::jsonb)         AS conformes
  FROM "token_casefiles";
-- ATTENDU : estimates = 1 · conformes = 1.

-- ─── VALIDATE — seulement si le post-check rend 1 / 1 ────────────────────
-- ALTER TABLE "token_casefiles" VALIDATE CONSTRAINT "token_casefiles_notional_estimate_requires_basis";

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- ALTER TABLE "token_casefiles" DROP CONSTRAINT IF EXISTS "token_casefiles_notional_estimate_requires_basis";
