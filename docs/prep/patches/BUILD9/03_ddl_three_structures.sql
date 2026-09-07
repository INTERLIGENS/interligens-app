-- ═══════════════════════════════════════════════════════════════════════════
-- BUILD 9 · BLOC 3/4 — LES TROIS STRUCTURES
--
-- ██  RÉDIGÉ, NON EXÉCUTÉ. Cible ep-square-band, éditeur SQL Neon.         ██
-- ██  ADDITIF UNIQUEMENT — aucun DROP, aucun ALTER de colonne existante.   ██
--
-- ─── POURQUOI TROIS, ET PAS SIX ───────────────────────────────────────────
--
-- Le schéma suit les faits démontrés, pas la forme des fichiers legacy.
-- Qualification du 2026-09-07, élément par élément :
--
--   timeline        BOTIFY 0/7   VINE 0/10   → aucun fait démontré, PAS de table
--   requisitions    BOTIFY 0/3   VINE 0/6    → aucun fait démontré, PAS de table
--   claims          BOTIFY 8/8               ┐
--   new_claims      VINE   8/9               ┘ MÊME structure, deux noms
--   shillers        VINE   9/9               → table
--   smoking_guns    VINE   1/13              → table
--
-- `claims` et `new_claims` partagent 9 clefs et un seul type applicatif
-- (`CaseFileClaim`). Le dédoublement est un artefact de nommage, pas deux
-- objets — d'où UNE table.
--
-- `wallets_onchain` n'est PAS créé : `token_casefiles."keyWallets"` existe,
-- est rempli, et porte déjà label/address/balance/pct_supply avec ses notes
-- d'attribution. Réutilisé tel quel.
--
-- ─── LES TROIS ÉTATS VIVENT DANS LE MODÈLE ────────────────────────────────
--
-- ATTACHED · ADMISSIBLE · PUBLIC, et aucun n'implique le suivant. Ils ne sont
-- pas un commentaire : ce sont des colonnes, avec des CHECK qui refusent les
-- promotions non gagnées. Voir src/lib/casefile/publicationState.ts.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Vocabulaires fermés ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "ArtifactState" AS ENUM ('ATTACHED', 'ADMISSIBLE', 'PUBLIC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ExclusionReason" AS ENUM
    ('EXCLUDED_FROM_PUBLICATION', 'INSUFFICIENT_PROVENANCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ══ 3.a · REGISTRE DE SOURCES ═════════════════════════════════════════════
--
-- Sans lui, une `evidenceRef` ne résout contre rien — c'est exactement l'état
-- de VINE : 39 références, 33 en prose, aucun registre local.
-- BOTIFY, lui, en a un : 8 sources, 8 références, 0 cassée.
CREATE TABLE IF NOT EXISTS "CaseFileSource" (
  id              text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "casefileRef"   text NOT NULL REFERENCES token_casefiles(ref) ON DELETE RESTRICT,
  "sourceId"      text NOT NULL,           -- SRC-001… : la clef que les claims citent
  "sourceType"    text NOT NULL,           -- screenshot | thread | onchain | document
  filename        text,
  caption         text,
  "capturedAt"    timestamptz,
  "sourceUrl"     text,
  sha256          text,
  -- Rattachement facultatif à un artefact déjà en base.
  "snapshotId"    text REFERENCES "EvidenceSnapshot"(id) ON DELETE SET NULL,
  "createdAt"     timestamptz NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CaseFileSource_ref_sourceid_key" UNIQUE ("casefileRef", "sourceId")
);
COMMENT ON TABLE "CaseFileSource" IS
  'BUILD 9 — registre de sources d''un dossier. Une evidenceRef qui ne resout '
  'pas ici est une reference cassee, et un claim qui en depend n''est pas '
  'admissible.';

-- ══ 3.b · CLAIMS ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "CaseFileClaim" (
  id                text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "casefileRef"     text NOT NULL REFERENCES token_casefiles(ref) ON DELETE RESTRICT,
  "claimId"         text NOT NULL,          -- C1… C17
  title             text NOT NULL,
  "titleFr"         text,
  description       text,
  "descriptionFr"   text,
  category          text,
  severity          text,
  status            text,                   -- CONFIRMED | UNCONFIRMED | DISPUTED
  "claimDate"       date,
  actors            jsonb,
  "threadUrl"       text,
  -- Les references citees. Leur RESOLUTION est verifiee par le post-check 3.4.
  "evidenceRefs"    jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- ── Data Nature : une assertion porte sa nature, ou n'est pas publiee ──
  "rowNature"       "DataNature",
  "natureBasis"     jsonb,
  "methodRef"       text,

  -- ── Les trois etats, et l'exclusion ──
  state             "ArtifactState" NOT NULL DEFAULT 'ATTACHED',
  "exclusionReason" "ExclusionReason",
  "excludedField"   text,                   -- le NOM du champ, jamais sa valeur

  -- ── Versioning immuable ──
  version           integer NOT NULL DEFAULT 1,
  supersedes        text REFERENCES "CaseFileClaim"(id) ON DELETE SET NULL,
  "contentHash"     text,
  "createdAt"       timestamptz NOT NULL DEFAULT now(),
  "updatedAt"       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "CaseFileClaim_ref_claimid_version_key"
    UNIQUE ("casefileRef", "claimId", version),

  -- Un claim PUBLIC doit porter sa nature ET au moins une reference.
  CONSTRAINT "CaseFileClaim_public_requires_provenance" CHECK (
    state <> 'PUBLIC'
    OR ("rowNature" IS NOT NULL
        AND "rowNature" <> 'UNCLASSIFIED'
        AND jsonb_array_length("evidenceRefs") > 0)
  ),
  -- Une ESTIMATE reste auditable : methode OU basis. Meme regle qu'ailleurs.
  CONSTRAINT "CaseFileClaim_estimate_auditable" CHECK (
    "rowNature" IS DISTINCT FROM 'ESTIMATE'
    OR "methodRef" IS NOT NULL
    OR ("natureBasis" IS NOT NULL AND "natureBasis" <> '{}'::jsonb)
  ),
  -- Une exclusion NOMME LE CHAMP. Republier le contenu annulerait le retrait.
  CONSTRAINT "CaseFileClaim_exclusion_names_field" CHECK (
    "exclusionReason" IS NULL
    OR ("excludedField" IS NOT NULL AND "excludedField" !~ '[0-9]{3,}')
  )
);
COMMENT ON TABLE "CaseFileClaim" IS
  'BUILD 9 — structure UNIQUE portant claims ET new_claims : 9 clefs communes '
  'et un seul type applicatif, le dedoublement etait un artefact de nommage.';

-- ══ 3.c · SHILLERS ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "CaseFileShiller" (
  id                text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "casefileRef"     text NOT NULL REFERENCES token_casefiles(ref) ON DELETE RESTRICT,
  handle            text NOT NULL,
  "realName"        text,
  role              text,
  followers         integer,                -- NULL = inconnu. JAMAIS 0 par defaut.
  severity          text,
  timing            text,
  "tweetUrl"        text,                   -- la provenance : 9/9 chez VINE
  "rowNature"       "DataNature",
  state             "ArtifactState" NOT NULL DEFAULT 'ATTACHED',
  "exclusionReason" "ExclusionReason",
  "excludedField"   text,
  version           integer NOT NULL DEFAULT 1,
  supersedes        text REFERENCES "CaseFileShiller"(id) ON DELETE SET NULL,
  "createdAt"       timestamptz NOT NULL DEFAULT now(),
  "updatedAt"       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CaseFileShiller_ref_handle_version_key"
    UNIQUE ("casefileRef", handle, version),
  -- Nommer une personne en public exige une source. Sans elle, pas de PUBLIC.
  CONSTRAINT "CaseFileShiller_public_requires_source" CHECK (
    state <> 'PUBLIC' OR "tweetUrl" IS NOT NULL
  )
);
COMMENT ON COLUMN "CaseFileShiller".followers IS
  'NULL = inconnu. Le preset BOTIFY posait 0 pour cinq shillers sur six, alors '
  'que la base porte 28 000 a 190 188 : un zero code en dur presente comme une '
  'donnee. NULL est une absence, 0 serait une affirmation.';

-- ══ 3.d · SMOKING GUNS ════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "CaseFileSmokingGun" (
  id                 text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "casefileRef"      text NOT NULL REFERENCES token_casefiles(ref) ON DELETE RESTRICT,
  "gunId"            text NOT NULL,         -- SG-1…
  tier               integer NOT NULL CHECK (tier BETWEEN 1 AND 3),
  title              text NOT NULL,
  description        text,
  "implicationFr"    text,
  "legalWeight"      text,
  -- La provenance on-chain : 1 element sur 13 la porte chez VINE (SG-1).
  "txSignature"      text,
  "blockTimeUtc"     timestamptz,
  wallet             text,
  "publicSource"     text,
  "rowNature"        "DataNature",
  state              "ArtifactState" NOT NULL DEFAULT 'ATTACHED',
  "exclusionReason"  "ExclusionReason",
  "excludedField"    text,
  version            integer NOT NULL DEFAULT 1,
  supersedes         text REFERENCES "CaseFileSmokingGun"(id) ON DELETE SET NULL,
  "createdAt"        timestamptz NOT NULL DEFAULT now(),
  "updatedAt"        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "CaseFileSmokingGun_ref_gunid_version_key"
    UNIQUE ("casefileRef", "gunId", version),
  -- Nommer une adresse n'est PAS prouver ce qu'elle a fait : un PUBLIC exige
  -- une signature de transaction ou une source publique resolvable.
  CONSTRAINT "CaseFileSmokingGun_public_requires_proof" CHECK (
    state <> 'PUBLIC' OR "txSignature" IS NOT NULL OR "publicSource" IS NOT NULL
  )
);

-- ── Index de lecture ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "CaseFileSource_ref_idx"     ON "CaseFileSource"("casefileRef");
CREATE INDEX IF NOT EXISTS "CaseFileClaim_ref_idx"      ON "CaseFileClaim"("casefileRef", state);
CREATE INDEX IF NOT EXISTS "CaseFileShiller_ref_idx"    ON "CaseFileShiller"("casefileRef", state);
CREATE INDEX IF NOT EXISTS "CaseFileSmokingGun_ref_idx" ON "CaseFileSmokingGun"("casefileRef", state);

COMMIT;

-- ─── POST-CHECKS — les quatre DOIVENT passer ──────────────────────────────

-- 3.1 · les quatre tables existent, et AUCUNE autre. ATTENDU : 4 lignes
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('CaseFileSource','CaseFileClaim','CaseFileShiller','CaseFileSmokingGun')
 ORDER BY 1;

-- 3.2 · timeline et requisitions n'ont PAS ete creees. ATTENDU : 0
SELECT count(*) AS tables_non_ratifiees
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('CaseFileTimeline','CaseFileRequisition','CaseFileWallet');

-- 3.3 · les CHECK de publication sont en place. ATTENDU : 5
SELECT count(*) AS gardes_de_publication
  FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
 WHERE rel.relname IN ('CaseFileClaim','CaseFileShiller','CaseFileSmokingGun')
   AND con.contype = 'c'
   AND con.conname LIKE '%public%' OR con.conname LIKE '%auditable%' OR con.conname LIKE '%names_field%';

-- 3.4 · les tables sont vides — le bloc 4 les remplit. ATTENDU : 0 · 0 · 0 · 0
SELECT (SELECT count(*) FROM "CaseFileSource")     AS sources,
       (SELECT count(*) FROM "CaseFileClaim")      AS claims,
       (SELECT count(*) FROM "CaseFileShiller")    AS shillers,
       (SELECT count(*) FROM "CaseFileSmokingGun") AS smoking_guns;

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- Additif pur, retrait symetrique. Aucune donnee preexistante n'est touchee.
--
--   DROP TABLE IF EXISTS "CaseFileSmokingGun", "CaseFileShiller",
--                        "CaseFileClaim", "CaseFileSource";
--   DROP TYPE  IF EXISTS "ArtifactState", "ExclusionReason";
