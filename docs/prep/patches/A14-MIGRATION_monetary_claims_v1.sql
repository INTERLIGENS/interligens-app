-- MIGRATION_monetary_claims_v1.sql
-- Chantier: A14 — INTERRUPTEUR DES AFFIRMATIONS MONÉTAIRES NOMINATIVES
-- Target DB: Neon ep-square-band UNIQUEMENT.
--
-- STATUS: NON APPLIQUÉE, ET NON DÉPLOYÉE. Exécution manuelle dans le Neon SQL
-- Editor. Claude Code n'applique aucune migration, ne lance jamais
-- prisma migrate ni prisma db push, et n'exécute aucun UPDATE.
--
-- EMPLACEMENT : ce fichier appartient à
-- `migrations/MIGRATION_monetary_claims_v1.sql`. Il vit provisoirement sous
-- docs/prep/patches/ parce que `^migrations/` est gelé par
-- scripts/guard-offline.sh. Aucun contournement n'a été fait.
--
-- ⚠️ ORDRE DE DÉPLOIEMENT IMPÉRATIF
--    1. Exécuter CETTE migration dans le Neon SQL Editor.
--    2. `pnpm prisma:generate`.
--    3. Déployer.
--    4. SEULEMENT ENSUITE, écrire des décisions de retrait.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- CE QU'ELLE FAIT, ET LA SEULE OPÉRATION NON ADDITIVE DU LOT
-- ═══════════════════════════════════════════════════════════════════════════
--
--   §1  ADD COLUMN  "KolProfile"."monetaryClaimsPublication"   ← additif
--   §2  élargit le CHECK de scope de KolProceedsPublicationLog ← voir ci-dessous
--   §3  index                                                  ← additif
--
-- **§2 est la seule opération non strictement additive de tous les chantiers
-- de cette session, et elle est signalée comme telle.** Élargir une contrainte
-- CHECK impose de la remplacer : les CHECK se composent en ET, en ajouter une
-- RESSERRE toujours, ne desserre jamais.
--
-- Trois garanties l'encadrent :
--   a. la nouvelle liste CONTIENT l'ancienne, mot pour mot — aucune valeur
--      déjà écrite ne peut devenir invalide ;
--   b. un contrôle préalable (§0) échoue la transaction si une ligne existante
--      sortait de la nouvelle liste ;
--   c. l'opération est dans le BEGIN/COMMIT : en cas d'échec, rien ne passe.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POURQUOI ON RÉUTILISE LE REGISTRE EXISTANT
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `KolProceedsPublicationLog` a été conçu keyé sur le HANDLE, avec un `scope`
-- déjà prévu pour quatre portées dont `'involvement'` — jamais utilisée. C'est
-- un registre d'affirmations monétaires nominatives, pas un registre de
-- `totalDocumented`. Créer un quatrième registre pour les mêmes personnes et
-- les mêmes montants rendrait impossible la question qui compte : « combien de
-- retraits, pour quel motif, sur cette personne ». On l'étend.
--
-- (Le narratif de blanchiment, lui, a bien reçu son propre registre en A12 :
-- ce n'est pas un montant agrégé, c'est un texte, et il peut y en avoir
-- plusieurs par personne. La règle est : un registre par NATURE d'objet, pas
-- un registre par table.)
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POURQUOI DEUX INTERRUPTEURS ET PAS UN
-- ═══════════════════════════════════════════════════════════════════════════
--
-- « Ce que la personne a encaissé » (`proceedsPublication`, existant) et
-- « l'ampleur du préjudice attribué » (`monetaryClaimsPublication`, nouveau)
-- ne sont pas la même affirmation. Sur `bkokoski` : 210 900 $ d'encaissement
-- retirés le 16 août, 4 500 000 $ de `totalScammed` — un facteur 21, et deux
-- assertions différentes. Les fondre ferait disparaître l'une avec l'autre
-- sans qu'aucune décision ne l'ait dit.
--
-- Ils se COMPOSENT EN ET côté code (src/lib/publication/monetaryGate.ts) : un
-- seul `withdrawn` suffit à taire un chiffre sur TOUS ses porteurs à la fois.
-- C'est le point : les 210 000 $ de `bkokoski` existent dans KolProceedsEvent,
-- dans une ligne KolEvidence `coordinated_exit`, et dans une phrase
-- LaundryTrail. Un interrupteur par table reconstruirait le défaut qu'on
-- corrige.
--
-- DEFAULT 'published' : **aucun état n'est basculé.** Les 411 profils gardent
-- leur comportement. Aucune décision n'est prise par cette migration.

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════
-- 0. CONTRÔLE PRÉALABLE — la transaction échoue si l'état n'est pas l'attendu
-- ══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE bad INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_name = 'KolProceedsPublicationLog') THEN
    RAISE EXCEPTION 'KolProceedsPublicationLog absente — MIGRATION_proceeds_containment_v1 non appliquée';
  END IF;

  -- Aucune ligne existante ne doit sortir de la NOUVELLE liste. Si celle-ci
  -- ne contenait pas l'ancienne, la migration s'arrêterait ici.
  SELECT count(*) INTO bad FROM "KolProceedsPublicationLog"
   WHERE "scope" NOT IN (
     'profile_total','summary','event','involvement',
     'scammed_total','case_paid','evidence_amount','monetary_all');
  IF bad > 0 THEN
    RAISE EXCEPTION 'La nouvelle liste de scope exclut % ligne(s) existante(s). Arrêt.', bad;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- 1. L'ÉTAT COURANT — nouvel interrupteur, famille « ampleur du préjudice »
-- ══════════════════════════════════════════════════════════════════════════
--
-- Additif. `totalScammed`, `paidUsd`, `amountUsd`, `proceedsUsd` ne sont
-- JAMAIS touchés : les valeurs restent lisibles en base, en admin, et par
-- toute réinvestigation. Seule leur PUBLICATION bascule.

ALTER TABLE "KolProfile"
  ADD COLUMN IF NOT EXISTS "monetaryClaimsPublication" TEXT NOT NULL DEFAULT 'published';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'KolProfile_monetaryClaimsPublication_allowed') THEN
    ALTER TABLE "KolProfile"
      ADD CONSTRAINT "KolProfile_monetaryClaimsPublication_allowed"
      CHECK ("monetaryClaimsPublication" IN ('published','withdrawn'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "KolProfile_monetaryClaimsPublication_idx"
  ON "KolProfile" ("monetaryClaimsPublication");

-- Lecture publique la plus fréquente : les deux interrupteurs ensemble.
CREATE INDEX IF NOT EXISTS "KolProfile_publication_pair_idx"
  ON "KolProfile" ("proceedsPublication", "monetaryClaimsPublication");

-- ══════════════════════════════════════════════════════════════════════════
-- 2. LE REGISTRE — quatre portées de plus, aucune retirée
-- ══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ SEULE OPÉRATION NON ADDITIVE DU LOT. Voir l'exposé en tête de fichier.
-- La nouvelle liste contient l'ancienne mot pour mot ; le §0 le prouve sur les
-- données réelles avant d'arriver ici.

ALTER TABLE "KolProceedsPublicationLog"
  DROP CONSTRAINT IF EXISTS "KolProceedsPublicationLog_scope_allowed";

ALTER TABLE "KolProceedsPublicationLog"
  ADD CONSTRAINT "KolProceedsPublicationLog_scope_allowed"
  CHECK ("scope" IN (
    -- ── les quatre portées d'origine, inchangées ───────────────────────────
    'profile_total',    -- KolProfile.totalDocumented — la surface publique
    'summary',          -- KolProceedsSummary.totalProceedsUsd
    'event',            -- une ligne KolProceedsEvent
    'involvement',      -- KolTokenInvolvement.proceedsUsd  (prévue, jamais utilisée)
    -- ── les quatre nouvelles ───────────────────────────────────────────────
    'scammed_total',    -- KolProfile.totalScammed        (jusqu'à 17,8 M$)
    'case_paid',        -- KolCase.paidUsd                (jusqu'à 48,3 M$)
    'evidence_amount',  -- KolEvidence.amountUsd          (jusqu'à 42 M$)
    'monetary_all'      -- « plus aucun chiffre sur cette personne »
  ));

COMMIT;

-- ─── VÉRIFICATION POST-EXÉCUTION ──────────────────────────────────────────
--
--   -- Doit rendre 411 lignes 'published', 0 'withdrawn' :
--   SELECT "monetaryClaimsPublication", count(*) FROM "KolProfile" GROUP BY 1;
--
--   -- Doit rendre les 8 portées :
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'KolProceedsPublicationLog_scope_allowed';
--
--   -- Doit rendre 6 : les décisions du 16 août, intactes.
--   SELECT count(*) FROM "KolProceedsPublicationLog";
--
--   -- Les montants restent lisibles — aucune donnée n'a bougé :
--   SELECT handle, "totalScammed", "totalDocumented" FROM "KolProfile"
--    WHERE "totalScammed" IS NOT NULL AND "totalScammed" > 0 ORDER BY 2 DESC;
--
-- ─── CE QUE CETTE MIGRATION NE FAIT PAS ───────────────────────────────────
--
--   * Elle ne retire RIEN et ne décide RIEN. Elle pose l'interrupteur.
--   * Elle ne touche ni totalScammed, ni paidUsd, ni amountUsd, ni proceedsUsd,
--     ni aucune ligne de KolProceedsPublicationLog.
--   * Elle ne modifie pas `proceedsPublication` ni les six décisions du 16 août.
--   * Après exécution seule, le comportement du produit est INCHANGÉ. Le
--     changement de comportement vient du CODE (monetaryGate), et il est
--     décrit en tête de src/lib/publication/monetaryGate.ts.
