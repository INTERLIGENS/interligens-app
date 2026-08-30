-- ═══════════════════════════════════════════════════════════════════════════
-- TÂCHE C — nature native de ShillCorrelationCandidate · 2026-08-30
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
--     • poser nature='INFERENCE' partout serait JUSTE ;
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

-- 1. nature — NULLABLE, SANS DEFAULT. Écrite ligne par ligne par l'upsert du
--    moteur, via assertNatureWritable (S6). Voir le verrou anti-backfill dans
--    src/lib/shill-correlation/v2/persistence.ts.
ALTER TABLE "ShillCorrelationCandidate"
  ADD COLUMN IF NOT EXISTS "nature" TEXT;

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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shillcorrcand_nature_declared_chk'
  ) THEN
    ALTER TABLE "ShillCorrelationCandidate"
      ADD CONSTRAINT "shillcorrcand_nature_declared_chk"
      CHECK ("nature" IS NULL OR "nature" = 'INFERENCE');
  END IF;
END $$;

-- C2. Une nature sans sa piste d'audit est exactement ce que ces colonnes
--     existent pour empêcher. Dès que `nature` est renseignée, les deux autres
--     le sont aussi — et natureBasis doit être un OBJET non vide, pas `{}`,
--     pas `null` jsonb, pas un scalaire.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shillcorrcand_nature_auditable_chk'
  ) THEN
    ALTER TABLE "ShillCorrelationCandidate"
      ADD CONSTRAINT "shillcorrcand_nature_auditable_chk"
      CHECK (
        "nature" IS NULL
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
--          count("nature")::int AS avec_nature,
--          count(*) FILTER (WHERE "nature" IS NULL)::int AS legacy_null,
--          count(DISTINCT "naturePolicyVersion")::int AS versions
--   FROM "ShillCorrelationCandidate";
--
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'ShillCorrelationCandidate'
--     AND column_name IN ('nature','natureBasis','naturePolicyVersion');
--   -- column_default DOIT être NULL sur les trois.
--
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = '"ShillCorrelationCandidate"'::regclass
--     AND conname LIKE 'shillcorrcand_nature%';
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (si nécessaire — aucune donnée n'est perdue, rien n'a été écrit)
-- ═══════════════════════════════════════════════════════════════════════════
--
--   ALTER TABLE "ShillCorrelationCandidate"
--     DROP CONSTRAINT IF EXISTS "shillcorrcand_nature_auditable_chk",
--     DROP CONSTRAINT IF EXISTS "shillcorrcand_nature_declared_chk",
--     DROP COLUMN IF EXISTS "naturePolicyVersion",
--     DROP COLUMN IF EXISTS "natureBasis",
--     DROP COLUMN IF EXISTS "nature";
