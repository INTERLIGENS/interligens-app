-- ═══════════════════════════════════════════════════════════════════════════
-- TÂCHE C — nature native de ShillCorrelationCandidate · 2026-08-30
--          (colonne renommée `nature` → `rowNature` le 2026-09-03)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- STATUS : NON EXÉCUTÉ. Préparé pour le Neon SQL Editor, projet ep-square-band.
-- CIBLE  : DATABASE_URL (ep-square-band). JAMAIS db push, JAMAIS prisma migrate
--          (verrou A9 : directUrl pointe une variable inexistante, P1012).
--          À coller à la main dans le Neon SQL Editor.
--
-- MESURÉ le 2026-08-30, ep-square-band, en lecture seule :
--   1 532 lignes · 3 kolHandle distincts · 0 ligne revue (reviewStatus='draft'
--   partout) · première écriture 2026-06-10, dernière 2026-08-28.
--   Les trois colonnes cibles n'existent pas (information_schema.columns = ∅).
--
-- MOTIF : la table est une sortie de moteur — INFERENCE par construction (Q3 :
--   la nature est celle de la DERNIÈRE OPÉRATION, pas des entrées). Elle est
--   déclarée telle au registre (src/lib/data-nature/registry.ts, régime
--   DECLARED), ce qui la couvre DÉJÀ, lignes legacy comprises.
--
--   Le type de `rowNature` est l'ENUM "DataNature" déjà en place (vérifié en base
--   le 2026-08-30), pas TEXT — même type que les 17 colonnes de nature du
--   produit.
--
--   Les trois colonnes n'ajoutent donc PAS la nature : elles ajoutent sa PISTE
--   D'AUDIT, deux faits par ligne que le registre ne peut pas porter —
--     natureBasis          : de quelles natures d'entrée CETTE ligne est tirée
--                            (le résolveur V3 ajoute une INFERENCE quand il a
--                            tranché pour ce token, pas sinon) ;
--     naturePolicyVersion  : sous quels seuils elle a été produite. Deux lignes
--                            scorées sous deux versions ne sont pas comparables,
--                            et sans ce champ rien ne le dirait.
--
-- ADDITIF, IF NOT EXISTS, RÉEXÉCUTABLE. Aucune colonne supprimée, aucune ligne
-- réécrite.
--
-- ██ AUCUN DEFAULT, AUCUN BACKFILL — ET C'EST LE POINT DE LA MIGRATION ██
--
--   Contrairement à MIGRATION_PROVENANCE (DEFAULT 'LIVE' sur 7 054 lignes, qui
--   ÉTAIENT toutes live), aucune valeur ne peut être posée ici sans mentir :
--     • poser rowNature='INFERENCE' partout serait JUSTE ;
--     • mais natureBasis et naturePolicyVersion, eux, seraient FAUX — les
--       1 532 lignes ont été calculées entre le 2026-06-10 et le 2026-08-28
--       sous des seuils qui ne sont pas ceux d'aujourd'hui, et leur basis
--       dépend d'une résolution de token propre à chaque ligne.
--     • une version fausse est pire qu'absente : elle rend comparables deux
--       lignes qui ne le sont pas.
--   Un DEFAULT produirait exactement ce mensonge à la lecture. Les colonnes
--   restent donc NULL jusqu'à ce que le moteur RE-PRODUISE chaque ligne.
--
--   NULL veut dire ici « produite avant que la nature ne soit tracée », PAS
--   « sans nature ». La nature vient du registre et vaut pour les 1 532.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. rowNature — type ENUM "DataNature", NULLABLE, SANS DEFAULT. Écrite ligne par
--    ligne par l'upsert du moteur, via assertNatureWritable (S6). Voir le
--    verrou anti-backfill dans src/lib/shill-correlation/v2/persistence.ts.
--
--    PAS TEXT : le type est celui déjà en place sur les 17 colonnes de nature
--    du produit (7 tables portent `rowNature "DataNature"`). Vérifié en base le
--    2026-08-30 — le type existe et porte 6 labels :
--      PRIMARY_OBSERVATION, THIRD_PARTY_DATA, INFERENCE, ESTIMATE,
--      EDITORIAL_ASSERTION, UNCLASSIFIED
--    Ce que l'enum apporte que TEXT n'apportait pas : une valeur hors domaine
--    est refusée par la BASE (22P02) au lieu d'être stockée puis relue comme
--    une nature valide. TEXT aurait laissé écrire 'inference', 'INFERENCE ',
--    ou 'PRIMARY_OBSERVATION' à un script contournant le module TS.
--
--    NOM DE COLONNE : `rowNature`, la convention du produit — 7 tables sur 7 la
--    portent (EvidenceItem, KolCase, KolTokenInvolvement, KolTokenLink,
--    KolWallet, TokenPriceTracker, token_casefiles). Cette table devient la 8e.
--    Décision du 2026-09-03, qui remplace le nom `nature` retenu le 2026-08-30 :
--    aucune colonne `nature` n'a jamais existé en base, et la migration n'ayant
--    PAS été exécutée, le renommage ne coûte aucun DDL de rattrapage.
ALTER TABLE "ShillCorrelationCandidate"
  ADD COLUMN IF NOT EXISTS "rowNature" "DataNature";

-- 2. natureBasis — jsonb. L'enveloppe d'inférence de LA ligne :
--    { natures: string[], occasionIds: string[], observationCount: int,
--      baselineBuyCount: int }
--    `baselineBuyCount` est le volume TÉMOIN, compté séparément du volume
--    observé : une inférence tirée de 400 observations et 0 achat témoin n'a
--    pas la même assise qu'une tirée de 400 et 400, et l'enveloppe doit
--    permettre de le voir sans relire le moteur.
ALTER TABLE "ShillCorrelationCandidate"
  ADD COLUMN IF NOT EXISTS "natureBasis" JSONB;

-- 3. naturePolicyVersion — la version de politique du run qui a écrit la ligne.
ALTER TABLE "ShillCorrelationCandidate"
  ADD COLUMN IF NOT EXISTS "naturePolicyVersion" TEXT;

-- ── CONTRAINTES : la base refuse ce que la doctrine interdit ───────────────
--
-- Le pack S6 a établi la règle : une doctrine qui ne tient que par l'omission
-- côté application ne tient pas. Les deux CHECK ci-dessous la rendent opposable
-- en base, y compris à un script qui contournerait le module TypeScript.

-- C1. La table est mono-nature. Une ligne porte INFERENCE, ou rien encore.
--     NULL passe : c'est l'état legacy, explicitement autorisé.
--     L'enum et ce CHECK ne font PAS le même travail : l'enum borne le DOMAINE
--     (6 valeurs possibles), le CHECK borne CETTE TABLE à une seule d'entre
--     elles. Sans le CHECK, un ESTIMATE serait un type valide ici.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shillcorrcand_rownature_declared_chk'
  ) THEN
    ALTER TABLE "ShillCorrelationCandidate"
      ADD CONSTRAINT "shillcorrcand_rownature_declared_chk"
      CHECK ("rowNature" IS NULL OR "rowNature" = 'INFERENCE'::"DataNature");
  END IF;
END $$;

-- C2. Une nature sans sa piste d'audit est exactement ce que ces colonnes
--     existent pour empêcher. Dès que `rowNature` est renseignée, les deux autres
--     le sont aussi — et natureBasis doit être un OBJET non vide, pas `{}`,
--     pas `null` jsonb, pas un scalaire.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shillcorrcand_rownature_auditable_chk'
  ) THEN
    ALTER TABLE "ShillCorrelationCandidate"
      ADD CONSTRAINT "shillcorrcand_rownature_auditable_chk"
      CHECK (
        "rowNature" IS NULL
        OR (
          "naturePolicyVersion" IS NOT NULL
          AND length("naturePolicyVersion") > 0
          AND "natureBasis" IS NOT NULL
          AND jsonb_typeof("natureBasis") = 'object'
          AND "natureBasis" <> '{}'::jsonb
        )
      );
  END IF;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS EXÉCUTION (lecture seule, à coller ensuite)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Attendu IMMÉDIATEMENT après la migration : 1 532 lignes, 1 532 NULL, 0 écrite.
-- Un chiffre non nul dans `avec_nature` juste après le DDL signifierait qu'un
-- backfill a eu lieu — c'est le contrôle, pas une formalité.
--
--   SELECT count(*)::int AS total,
--          count("rowNature")::int AS avec_nature,
--          count(*) FILTER (WHERE "rowNature" IS NULL)::int AS legacy_null,
--          count(DISTINCT "naturePolicyVersion")::int AS versions
--   FROM "ShillCorrelationCandidate";
--
--   SELECT column_name, data_type, udt_name, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'ShillCorrelationCandidate'
--     AND column_name IN ('rowNature','natureBasis','naturePolicyVersion');
--   -- ATTENDU :
--   --   rowNature           | USER-DEFINED | DataNature | YES | NULL
--   --   natureBasis         | jsonb        | jsonb      | YES | NULL
--   --   naturePolicyVersion | text         | text       | YES | NULL
--   -- column_default DOIT être NULL sur les trois. `data_type = 'text'` sur
--   -- `rowNature` signifierait que le type enum n'a PAS été appliqué.
--
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = '"ShillCorrelationCandidate"'::regclass
--     AND conname LIKE 'shillcorrcand_rownature%';
--   -- Deux lignes attendues, C1 et C2. Le motif du 2026-08-30 était
--   -- 'shillcorrcand_nature%' : les deux CHECK ayant suivi la colonne, il ne
--   -- ramènerait plus rien. Un LIKE qui rend zéro ligne se lit comme « pas de
--   -- contrainte » — d'où le motif corrigé plutôt que laissé tel quel.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (si nécessaire — aucune donnée n'est perdue, rien n'a été écrit)
-- ═══════════════════════════════════════════════════════════════════════════
--
--   ALTER TABLE "ShillCorrelationCandidate"
--     DROP CONSTRAINT IF EXISTS "shillcorrcand_rownature_auditable_chk",
--     DROP CONSTRAINT IF EXISTS "shillcorrcand_rownature_declared_chk",
--     DROP COLUMN IF EXISTS "naturePolicyVersion",
--     DROP COLUMN IF EXISTS "natureBasis",
--     DROP COLUMN IF EXISTS "rowNature";
