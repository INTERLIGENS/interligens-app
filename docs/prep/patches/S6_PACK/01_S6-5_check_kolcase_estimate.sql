-- ═══════════════════════════════════════════════════════════════════════════
-- S6-5 · CHECK KolCase — une ESTIMATE porte une méthode CANONIQUE · 7/7
--        DÉPEND DU FICHIER 00 (sans le DROP DEFAULT, le CHECK est complaisant).
--
-- Trois exigences, pas une :
--   1. methodologyRef non-null
--   2. conforme à la GRAMMAIRE canonique
--   3. différent de '/en/methodology'
--
-- La 3e est redondante avec la 2e — la grammaire rejette déjà une chaîne qui
-- commence par '/'. Elle est écrite quand même, nommément : cette colonne a
-- porté cette valeur comme DEFAULT pendant des mois, et un lecteur du CHECK
-- doit voir l'interdit sans avoir à dérouler une regex dans sa tête.
--
-- ─── LA GRAMMAIRE VIENT DU CODE, ELLE N'EST PAS REDÉRIVÉE ────────────────
-- Motif ci-dessous = METHOD_REF_PATTERN_BODY de src/lib/data-nature/methodRef.ts,
-- recopié à l'identique. C'est la duplication de cette règle en deux endroits
-- qui avait produit deux grammaires incompatibles (S6-0) ; ici la base
-- REPRODUIT la source unique, un test applicatif vérifiant l'égalité des deux
-- chaînes. Toute évolution se fait dans le TS d'abord.
--
--     ^[a-z][a-z0-9-]{1,63}/[a-z][a-z0-9-]{1,63}@v[0-9]+$
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "KolCase"
  ADD CONSTRAINT "KolCase_estimate_requires_canonical_methodref"
  CHECK (
    "rowNature" IS DISTINCT FROM 'ESTIMATE'
    OR (
         "methodologyRef" IS NOT NULL
     AND "methodologyRef" <> '/en/methodology'
     AND "methodologyRef" ~ '^[a-z][a-z0-9-]{1,63}/[a-z][a-z0-9-]{1,63}@v[0-9]+$'
    )
  ) NOT VALID;

-- ─── POURQUOI NOT VALID D'ABORD ──────────────────────────────────────────
-- La contrainte s'applique immédiatement aux ÉCRITURES ; NOT VALID diffère
-- seulement la revalidation de l'existant. Les 7 lignes la satisfont déjà —
-- ce n'est donc pas un aveu de dette, mais la garantie qu'un VALIDATE ne
-- surprenne pas au milieu d'une migration. On PROUVE, puis on valide.

-- ─── POST-CHECK — à lire AVANT de valider ────────────────────────────────
SELECT count(*) FILTER (WHERE "rowNature" = 'ESTIMATE')                    AS estimates,
       count(*) FILTER (WHERE "rowNature" = 'ESTIMATE'
                          AND "methodologyRef" ~ '^[a-z][a-z0-9-]{1,63}/[a-z][a-z0-9-]{1,63}@v[0-9]+$')    AS conformes,
       count(*) FILTER (WHERE "rowNature" = 'ESTIMATE'
                          AND "methodologyRef" = '/en/methodology')        AS legacy_restantes
  FROM "KolCase";
-- ATTENDU : estimates = 7 · conformes = 7 · legacy_restantes = 0.
-- Toute autre valeur = ARRÊT, et NE PAS exécuter le VALIDATE ci-dessous.

-- ─── VALIDATE — seulement si le post-check rend 7 / 7 / 0 ────────────────
-- ALTER TABLE "KolCase" VALIDATE CONSTRAINT "KolCase_estimate_requires_canonical_methodref";

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- ALTER TABLE "KolCase" DROP CONSTRAINT IF EXISTS "KolCase_estimate_requires_canonical_methodref";
