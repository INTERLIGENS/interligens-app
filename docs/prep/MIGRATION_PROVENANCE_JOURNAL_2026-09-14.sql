-- ═══════════════════════════════════════════════════════════════════════════
-- T2-PROVENANCE-JOURNAL — LE JOURNAL DE PROVENANCE D'UNE PIÈCE — DDL ADDITIF
-- Fichier : docs/prep/MIGRATION_PROVENANCE_JOURNAL_2026-09-14.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ NON APPLIQUÉ. À coller dans l'ÉDITEUR SQL NEON (ep-square-band), après
--    snapshot de branche. JAMAIS `prisma db push`, JAMAIS `prisma migrate` —
--    les deux schemas portent le verrou A9 et s'arrêtent sur P1012.
--
-- Ruling GPT du 14/09 :
--   « La provenance d'une pièce doit être journalisée, append-only, spécifique
--     à la pièce, et NON inférée. »
--   « Discovery context is not source provenance. »
--   « A grep n'est pas une provenance. »
--
-- Le constat qui commande (mesuré le 2026-09-14 sur "EvidenceSnapshot") :
--   1171 pièces · 753 portent une URL de RECHERCHE (/search?) · 213 une URL de
--   statut (/status/) · 144 une autre forme · 61 aucune. 927 portent un sha256.
--   La colonne "sourceUrl" mélange donc le contexte de découverte et la source,
--   sans dire lequel. Ce journal ne la corrige pas : il dit, ligne par ligne,
--   ce qu'on SAIT de la provenance, qui l'a dit, et ce qui a été vérifié.
--
-- ⛔ AUCUN BACKFILL. L'absence de ligne pour une pièce VAUT UNKNOWN. Aucune
--    ligne n'est fabriquée à partir de "sourceUrl" : une URL de recherche
--    recopiée en provenance serait exactement l'inférence que le ruling refuse.
--
-- ADDITIF ET SEULEMENT ADDITIF : aucune table existante n'est touchée. La
-- table "EvidenceSnapshot" n'est que RÉFÉRENCÉE.
--
-- ─── PRÉREQUIS MESURÉS le 2026-09-14 (information_schema / pg_catalog) ───────
--   · table cible : public."EvidenceSnapshot" — camelCase, guillemets obligatoires
--   · id text NOT NULL · PRIMARY KEY (id) = "EvidenceSnapshot_pkey"
--     → l'identité gouvernée de la pièce EXISTE et est posable en FK.
--   · sha256 text NULL · index UNIQUE "EvidenceSnapshot_sha256_key" (un INDEX,
--     pas une contrainte : invisible dans pg_constraint). 244 pièces sans sha256.
--   · governed_objects : 1 ligne, object_nature = CASEFILE_RENDER. AUCUNE ligne
--     EVIDENCE_CAPTURE : le registre R2 ne porte pas aujourd'hui l'identité des
--     pièces. La seule identité gouvernée exploitable est "EvidenceSnapshot".id.
--   · les 46 pièces de 00_INBOX_RAW (manifeste hors dépôt) ne sont dans AUCUNE
--     table. Elles n'ont pas d'identité gouvernée en base : elles ne peuvent
--     recevoir une ligne ici qu'une fois devenues un EvidenceSnapshot. C'est un
--     point d'architecture remonté dans le rapport, pas réglé ici.
--   · PostgreSQL 17.11 · 0 trigger sur "EvidenceSnapshot"
--   · casefile_claim_publication_decisions_append_only() existe déjà : le motif
--     append-only est ÉPROUVÉ en production. On le reproduit, on ne le partage
--     pas (une fonction par table : le message nomme la table, et retirer l'une
--     ne désarme pas l'autre).
--
-- ─── POURQUOI LA CIBLE EST L'IDENTITÉ, PAS LE HASH ──────────────────────────
--   Le sha256 identifie des OCTETS, pas un contexte d'acquisition. Deux
--   acquisitions distinctes des mêmes octets sont deux provenances. Et 244
--   pièces n'ont pas de sha256 : une clé par hash les rendrait injournalisables.
--   Le sha256 est donc conservé comme ATTRIBUT — ce qu'on savait des octets au
--   moment de l'écriture — jamais comme clé.
--
-- ─── CE QUE LA TABLE GARANTIT PAR STRUCTURE ─────────────────────────────────
--   1. une ligne vise une pièce qui EXISTE                → FK RESTRICT/RESTRICT
--   2. les domaines sont FERMÉS                           → CHECK énumérés
--   3. VERIFIED ⇔ (qui, quand, comment) tous les trois    → CHECK, pas convention
--   4. UNKNOWN ⇔ aucune référence                         → CHECK
--   5. un contexte de découverte n'est JAMAIS vérifié
--      comme source                                       → CHECK
--   6. le dernier état connu est NON AMBIGU               → id IDENTITY, ordre total
--   7. on n'écrase jamais une ligne                       → triggers (section marquée)
--
-- ─── COLONNES : la forme minimale de GPT, sans ajout ────────────────────────
--   id · evidence_snapshot_id · sha256 · provenance_kind · reference_kind ·
--   source_url · declared_by · declared_at · verified_by · verified_at ·
--   verification_method · recorded_at
--   declared_at et verified_at SANS DEFAULT, par conception : ce sont des
--   données DÉCLARÉES, pas l'horloge du serveur. recorded_at est l'horloge de
--   la base — la seule qui ordonne (même règle que la table de décisions).

BEGIN;

CREATE TABLE IF NOT EXISTS evidence_provenance_journal (
  -- L'ORDRE des états. IDENTITY : monotone, jamais réutilisé, jamais fourni
  -- par l'appelant. « Le dernier état connu » = max(id) par pièce. Les TROUS
  -- sont normaux (un INSERT refusé consomme sa valeur) ; seul l'ORDRE compte.
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- ── La CIBLE : l'identité GOUVERNÉE de la pièce, jamais son hash.
  evidence_snapshot_id  TEXT NOT NULL,

  -- ── Attribut, pas clé. NULL = « non établi », jamais une valeur inventée.
  sha256                TEXT
                        CONSTRAINT evidence_provenance_journal_sha256_check
                        CHECK (sha256 ~ '^[0-9a-f]{64}$'),

  -- ── Ce qu'on SAIT. Domaine fermé.
  --   UNKNOWN           : rien d'établi (requalification explicite ; l'absence
  --                       de ligne vaut déjà UNKNOWN)
  --   OPERATOR_DECLARED : un opérateur affirme la référence, sans preuve jointe
  --   EXTRACTED         : la référence est lue dans la pièce elle-même ou ses
  --                       métadonnées (WhereFroms, barre d'adresse visible…)
  --   VERIFIED          : la référence a été confrontée au contenu visible de
  --                       la pièce, par une méthode admise ci-dessous
  provenance_kind       TEXT NOT NULL
                        CONSTRAINT evidence_provenance_journal_provenance_kind_check
                        CHECK (provenance_kind IN ('UNKNOWN', 'OPERATOR_DECLARED', 'EXTRACTED', 'VERIFIED')),

  -- ── Ce QU'EST la référence. Domaine fermé.
  --   QUERY_CONTEXT : une page de recherche, un fil filtré — le contexte de
  --                   DÉCOUVERTE. Ce n'est pas la source, et la table l'écrit.
  --   PUBLICATION   : le post, le message, l'article lui-même
  --   PROFILE       : la page de l'auteur
  --   DOCUMENT      : un fichier (PDF, export, pièce interne)
  --   OTHER         : nommé tel quel, pour ne pas forcer un domaine faux
  reference_kind        TEXT
                        CONSTRAINT evidence_provenance_journal_reference_kind_check
                        CHECK (reference_kind IN ('QUERY_CONTEXT', 'PUBLICATION', 'PROFILE', 'DOCUMENT', 'OTHER')),

  source_url            TEXT
                        CONSTRAINT evidence_provenance_journal_source_url_check
                        CHECK (source_url <> '' AND btrim(source_url) = source_url),

  -- ── QUI affirme, et QUAND selon lui. Toute ligne est un acte signé, y
  -- compris une requalification en UNKNOWN. Non vide, sans blanc de bord.
  declared_by           TEXT NOT NULL
                        CONSTRAINT evidence_provenance_journal_declared_by_check
                        CHECK (declared_by <> '' AND btrim(declared_by) = declared_by),
  -- PAS de DEFAULT, à dessein : un défaut fabriquerait une déclaration
  -- « maintenant » que personne n'a datée.
  declared_at           TIMESTAMPTZ NOT NULL,

  -- ── QUI a vérifié, QUAND, et COMMENT. Les trois ensemble, ou aucun.
  verified_by           TEXT
                        CONSTRAINT evidence_provenance_journal_verified_by_check
                        CHECK (verified_by <> '' AND btrim(verified_by) = verified_by),
  -- PAS de DEFAULT, même raison que declared_at.
  verified_at           TIMESTAMPTZ,
  -- La méthode est BORNÉE. « L'URL répond » (HTTP 200) n'est PAS une méthode
  -- admise : un lien vivant ne prouve pas qu'il montre ce que la pièce montre.
  -- Chaque méthode admise confronte la référence au CONTENU VISIBLE de la pièce.
  --   URL_MATCHES_CAPTURED_POST   : l'URL ouverte affiche le post de la pièce —
  --                                 auteur, texte, horodatage concordants
  --   ARCHIVE_SNAPSHOT_MATCHES    : une copie d'archive (Wayback, archive.today)
  --                                 de l'URL concorde avec la pièce
  --   PLATFORM_API_RECORD_MATCHES : l'enregistrement API de la plateforme pour
  --                                 cet identifiant concorde avec la pièce
  verification_method   TEXT
                        CONSTRAINT evidence_provenance_journal_verification_method_check
                        CHECK (verification_method IN ('URL_MATCHES_CAPTURED_POST', 'ARCHIVE_SNAPSHOT_MATCHES', 'PLATFORM_API_RECORD_MATCHES')),

  -- ── L'horloge de la base : quand la ligne a été ÉCRITE. La seule qui ordonne.
  recorded_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── COHÉRENCE 1 : VERIFIED ⇔ (verified_by, verified_at, verification_method)
  -- tous NON NULL ; sinon tous NULL. Un CHECK, pas une convention.
  CONSTRAINT evidence_provenance_journal_verified_iff_verification_check
    CHECK (
      (provenance_kind = 'VERIFIED') = (verified_by IS NOT NULL)
      AND (provenance_kind = 'VERIFIED') = (verified_at IS NOT NULL)
      AND (provenance_kind = 'VERIFIED') = (verification_method IS NOT NULL)
    ),

  -- ── COHÉRENCE 2 : UNKNOWN ⇔ aucune référence. Une URL sous UNKNOWN serait
  -- une déclaration qui ne dit pas son nom ; une déclaration sans référence ne
  -- déclare rien.
  CONSTRAINT evidence_provenance_journal_unknown_has_no_reference_check
    CHECK (
      (provenance_kind = 'UNKNOWN') = (source_url IS NULL)
      AND (provenance_kind = 'UNKNOWN') = (reference_kind IS NULL)
    ),

  -- ── COHÉRENCE 3 : « Discovery context is not source provenance. » Un contexte
  -- de découverte peut être déclaré ou extrait — jamais VÉRIFIÉ comme source :
  -- ce qu'on vérifierait, c'est que la recherche retrouve le post, pas que la
  -- pièce vient de là. (Ajout à la forme minimale, signalé dans le rapport.)
  CONSTRAINT evidence_provenance_journal_verified_not_query_context_check
    CHECK (NOT (provenance_kind = 'VERIFIED' AND reference_kind = 'QUERY_CONTEXT')),

  -- ── LA CONTRAINTE : aucune ligne ne vise une pièce qui n'existe pas.
  -- RESTRICT des deux côtés : une pièce qui porte un journal ne se supprime pas
  -- et ne se renumérote pas — l'historique de la provenance tient à la pièce.
  CONSTRAINT evidence_provenance_journal_snapshot_fkey
    FOREIGN KEY (evidence_snapshot_id)
    REFERENCES "EvidenceSnapshot" (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

-- La RELECTURE : « le dernier état connu de cette pièce ». Égalité sur la
-- pièce, puis id décroissant. Le même index sert les vérifications de la FK.
CREATE INDEX IF NOT EXISTS evidence_provenance_journal_snapshot_idx
  ON evidence_provenance_journal (evidence_snapshot_id, id DESC);

COMMENT ON TABLE evidence_provenance_journal IS
  'T2-PROVENANCE-JOURNAL. Journal APPEND-ONLY de la provenance d''une piece ("EvidenceSnapshot"). '
  'Le dernier etat connu = max(id) par evidence_snapshot_id ; une requalification est une NOUVELLE '
  'ligne, jamais un UPDATE. L''absence de ligne VAUT UNKNOWN : aucun backfill. Un QUERY_CONTEXT '
  'n''est jamais une provenance VERIFIED. sha256 est un attribut, jamais une cle.';

-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ DDL SUPPLÉMENTAIRE — APPEND-ONLY PAR TRIGGER. HORS DU « MINIMUM » DE GPT.
-- ═══════════════════════════════════════════════════════════════════════════
-- Exactement le motif éprouvé sur casefile_claim_publication_decisions :
-- TRIGGER qui LÈVE restrict_violation, ni RULE (échoue en silence) ni REVOKE
-- (l'application est propriétaire de la table). Barrière contre le code et
-- l'erreur ; pas contre le propriétaire, qui peut faire DROP TRIGGER — le
-- vérificateur rougit alors.

CREATE OR REPLACE FUNCTION evidence_provenance_journal_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'evidence_provenance_journal est APPEND-ONLY : % refusé. Une provenance ne se corrige pas, elle est suivie d''une nouvelle ligne.',
    TG_OP
    USING ERRCODE = 'restrict_violation';
END
$$;

CREATE OR REPLACE TRIGGER evidence_provenance_journal_no_rewrite
  BEFORE UPDATE OR DELETE ON evidence_provenance_journal
  FOR EACH ROW EXECUTE FUNCTION evidence_provenance_journal_append_only();

-- TRUNCATE ne passe pas par les triggers de ligne.
CREATE OR REPLACE TRIGGER evidence_provenance_journal_no_truncate
  BEFORE TRUNCATE ON evidence_provenance_journal
  FOR EACH STATEMENT EXECUTE FUNCTION evidence_provenance_journal_append_only();

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- LA LECTURE CANONIQUE — « dernier état connu »
-- ═══════════════════════════════════════════════════════════════════════════
-- Une pièce :
--
--   SELECT provenance_kind, reference_kind, source_url, sha256,
--          declared_by, declared_at, verified_by, verified_at, verification_method,
--          recorded_at
--     FROM evidence_provenance_journal
--    WHERE evidence_snapshot_id = $1
--    ORDER BY id DESC
--    LIMIT 1;
--   → 0 ligne = UNKNOWN. Le lecteur ne consulte JAMAIS "EvidenceSnapshot"."sourceUrl"
--     pour combler : ce serait l'inférence que le ruling refuse.
--
-- Toutes les pièces, avec UNKNOWN explicite pour celles sans ligne :
--
--   SELECT s.id AS evidence_snapshot_id,
--          COALESCE(j.provenance_kind, 'UNKNOWN') AS provenance_kind,
--          j.reference_kind, j.source_url, j.verification_method, j.recorded_at
--     FROM "EvidenceSnapshot" s
--     LEFT JOIN LATERAL (
--       SELECT * FROM evidence_provenance_journal
--        WHERE evidence_snapshot_id = s.id
--        ORDER BY id DESC LIMIT 1
--     ) j ON true;
--
-- Une requalification = INSERT d'une nouvelle ligne (même evidence_snapshot_id,
-- id supérieur). L'ancienne reste lisible : ORDER BY id pour l'historique.

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS POSE — à exécuter, et à LIRE
-- ═══════════════════════════════════════════════════════════════════════════
--   npx tsx scripts/casefile/verifier-provenance-journal-schema.ts
--   → 0 conforme · 2 table absente · 3 écarts nommés
--
-- À la main, si besoin :
--
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'evidence_provenance_journal'
--    ORDER BY ordinal_position;
--
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'evidence_provenance_journal'::regclass;
--
--   SELECT tgname FROM pg_trigger
--    WHERE tgrelid = 'evidence_provenance_journal'::regclass AND NOT tgisinternal;
--
-- Attendu : 12 colonnes · 1 PK · 10 CHECK · 1 FK · 1 index cible · 2 triggers · 0 ligne.
