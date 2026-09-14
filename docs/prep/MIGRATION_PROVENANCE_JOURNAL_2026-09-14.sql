-- ═══════════════════════════════════════════════════════════════════════════
-- T2-PROVENANCE-JOURNAL — LE JOURNAL DE PROVENANCE D'UNE PIÈCE — DDL ADDITIF
-- Fichier : docs/prep/MIGRATION_PROVENANCE_JOURNAL_2026-09-14.sql
-- Amendé T1-JOURNAL-AMENDE-ET-MESURE (2026-09-14, décisions GPT 4a / 4b / 5)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ NON APPLIQUÉ. À coller dans l'ÉDITEUR SQL NEON (ep-square-band), après
--    snapshot de branche. JAMAIS `prisma db push`, JAMAIS `prisma migrate` —
--    les deux schemas portent le verrou A9 et s'arrêtent sur P1012.
--
-- Ruling GPT du 14/09 (première série) :
--   « La provenance d'une pièce doit être journalisée, append-only, spécifique
--     à la pièce, et NON inférée. »
--   « Discovery context is not source provenance. »
--   « A grep n'est pas une provenance. »
--
-- Décisions GPT du 14/09 (seconde série), qui AMENDENT ce fichier :
--   4a  Le journal ne porte PLUS d'état UNKNOWN. « Absence de ligne = UNKNOWN
--       dérivé. Une ligne append-only doit représenter une qualification
--       effectivement APPORTÉE, pas enregistrer l'absence de qualification. »
--       Domaine : OPERATOR_DECLARED | EXTRACTED | VERIFIED. Rien d'autre.
--       → la contrainte unknown_has_no_reference DISPARAÎT : elle n'a plus d'objet.
--   4b  verified_not_query_context est CONSERVÉE. « Un QUERY_CONTEXT peut être
--       documenté comme contexte de découverte, mais il ne peut pas être la
--       référence de provenance individuelle vérifiée d'un post. »
--   5   Le journal devient l'AUTORITÉ sur la provenance :
--         EvidenceSnapshot            → identité de l'observation
--         evidence_provenance_journal → autorité sur la provenance et la
--                                       nature de la référence
--         CaseFileSource              → projection de cette Evidence dans un dossier
--         CaseFileClaim               → assertion fondée sur cette source
--       CaseFileSource.sourceUrl n'est plus une preuve autonome de provenance.
--       Divergence journal ↔ CaseFileSource = FAIL CLOSED. Aucun backfill ne
--       transforme les anciennes valeurs en autorité.
--
-- Ruling GPT du 14/09 (troisième série, T1-DDL-PHASE-A-PRET-A-POSER) :
--   · VINE devient le dossier témoin du RC ; BOTIFY sort du chemin critique et
--     n'est PAS reconstruit. Les 8 sources BOTIFY restent UNKNOWN dérivé :
--     « historical persisted ATTACHED ≠ currently foundation-eligible under a
--     strengthened contract ». Aucune réécriture rétroactive.
--   · AUCUN repli sha256 : snapshotId NULL → UNKNOWN ; snapshotId présent sans
--     ligne → UNKNOWN ; snapshotId présent + journal → dernière qualification.
--     « A byte digest may corroborate identity; it must not elect observation
--     identity. » Le journal reste clé par "EvidenceSnapshot".id.
--   · source_url NOT NULL et reference_kind NOT NULL : VALIDÉS. La forme de
--     source_url est CONDITIONNÉE par reference_kind, sans CHECK global
--     ^https?:// (voir le CHECK source_url_form_by_kind ci-dessous).
--   · source_url est sémantiquement un SOURCE LOCATOR (il peut porter une clé
--     R2). GPT ne veut PAS de renommage maintenant ; renommage en
--     source_locator envisageable APRÈS le RC. La sémantique est documentée
--     sur la colonne, pas renommée.
--   · FK "CaseFileSource"."snapshotId" durcie en RESTRICT/RESTRICT : troisième
--     DDL, fichier séparé docs/prep/MIGRATION_FK_SNAPSHOTID_RESTRICT_2026-09-14.sql.
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
--   · (T1, 2026-09-14) "CaseFileSource"."snapshotId" text NULL, FK
--     "CaseFileSource_snapshotId_fkey" → "EvidenceSnapshot"(id) ON DELETE SET
--     NULL. C'est le SEUL pont projection → observation. 2 sources sur 10 le
--     portent (SRC-0xS-09 → 34f4068a-57d8-45c5-9c8a-47b29b931e1b, SRC-0xS-18 →
--     f24e3252-7d16-41a3-8253-eb0c1be67654, sha256 concordants) ; les 8 sources
--     BOTIFY n'ont ni snapshotId, ni sha256, ni sourceUrl, et aucun
--     EvidenceSnapshot ne porte leurs fichiers IMG_2239…2246.
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
--   2. les domaines sont FERMÉS, et UNKNOWN n'en fait
--      pas partie                                         → CHECK énumérés
--   3. VERIFIED ⇔ (qui, quand, comment) tous les trois    → CHECK, pas convention
--   4. une ligne porte TOUJOURS une référence et sa
--      nature (une qualification apportée qualifie
--      quelque chose)                                     → NOT NULL
--   5. la FORME du localisateur suit la NATURE de la
--      référence (URL HTTP(S) · objet R2 · URI)           → CHECK conditionnel
--   6. un contexte de découverte n'est JAMAIS vérifié
--      comme source                                       → CHECK
--   7. le dernier état connu est NON AMBIGU               → id IDENTITY, ordre total
--   8. on n'écrase jamais une ligne                       → triggers (section marquée)
--
-- ─── COLONNES : la forme minimale de GPT, sans ajout ────────────────────────
--   id · evidence_snapshot_id · sha256 · provenance_kind · reference_kind ·
--   source_url · declared_by · declared_at · verified_by · verified_at ·
--   verification_method · recorded_at
--   declared_at et verified_at SANS DEFAULT, par conception : ce sont des
--   données DÉCLARÉES, pas l'horloge du serveur. recorded_at est l'horloge de
--   la base — la seule qui ordonne (même règle que la table de décisions).
--
-- ─── LES QUATRE AXES RESTENT SÉPARÉS ────────────────────────────────────────
--   qui a capturé la pièce        → "EvidenceSnapshot" (hors de cette table)
--   comment l'URL a été obtenue   → provenance_kind
--   ce que cette URL désigne      → reference_kind
--   si la correspondance a été
--   vérifiée, par qui et comment  → verified_by · verified_at · verification_method
--   Aucune colonne n'en porte deux.

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

  -- ── COMMENT la référence a été obtenue. Domaine fermé, SANS UNKNOWN (4a).
  --   OPERATOR_DECLARED : un opérateur affirme la référence, sans preuve jointe
  --   EXTRACTED         : la référence est lue dans la pièce elle-même ou ses
  --                       métadonnées (WhereFroms, barre d'adresse visible…)
  --   VERIFIED          : la référence a été confrontée au contenu visible de
  --                       la pièce, par une méthode admise ci-dessous
  --   UNKNOWN n'est PAS une valeur de cette colonne : c'est l'ABSENCE de ligne,
  --   dérivée à la lecture (COALESCE, voir la lecture canonique). Une ligne
  --   « UNKNOWN » enregistrerait une absence de qualification, ce qu'un journal
  --   de qualifications apportées ne fait pas.
  provenance_kind       TEXT NOT NULL
                        CONSTRAINT evidence_provenance_journal_provenance_kind_check
                        CHECK (provenance_kind IN ('OPERATOR_DECLARED', 'EXTRACTED', 'VERIFIED')),

  -- ── Ce QU'EST la référence. Domaine fermé.
  --   QUERY_CONTEXT : une page de recherche, un fil filtré — le contexte de
  --                   DÉCOUVERTE. Ce n'est pas la source, et la table l'écrit.
  --   PUBLICATION   : le post, le message, l'article lui-même
  --   PROFILE       : la page de l'auteur
  --   DOCUMENT      : un fichier (PDF, export, pièce interne)
  --   OTHER         : nommé tel quel, pour ne pas forcer un domaine faux
  --
  -- NOT NULL — tranché le 2026-09-14 (T1), avec source_url ci-dessous :
  --   Depuis 4a, une ligne est une qualification APPORTÉE. Qualifier, c'est
  --   dire COMMENT une référence a été obtenue (provenance_kind) et CE QU'ELLE
  --   désigne (reference_kind). Une ligne sans référence ne qualifie rien :
  --   elle dirait « quelqu'un a déclaré » sans dire quoi — c'est la ligne
  --   UNKNOWN qui vient d'être bannie, sous un autre nom. Les trois valeurs du
  --   domaine présupposent une référence (déclarée, extraite, vérifiée) ; la
  --   seule qui n'en présupposait pas était UNKNOWN. Le NOT NULL est donc la
  --   forme structurelle de 4a, et il remplace unknown_has_no_reference par un
  --   invariant plus simple : toute ligne porte une référence ET sa nature.
  --   Une référence dont la nature ne tient dans aucun domaine se déclare
  --   OTHER — elle ne se tait pas.
  reference_kind        TEXT NOT NULL
                        CONSTRAINT evidence_provenance_journal_reference_kind_check
                        CHECK (reference_kind IN ('QUERY_CONTEXT', 'PUBLICATION', 'PROFILE', 'DOCUMENT', 'OTHER')),

  -- NOT NULL — même décision, même motif. Une qualification qui ne peut pas
  -- dire OÙ se lit sa référence n'a pas de référence, et n'a donc pas de
  -- ligne. Nullable, la colonne aurait laissé passer une déclaration sans
  -- objet que plus aucun CHECK ne refusait.
  --
  -- SÉMANTIQUE : SOURCE LOCATOR (ruling GPT, T1-DDL-PHASE-A). Le nom
  -- `source_url` est conservé tel quel — pas de renommage avant le RC — mais
  -- la colonne porte le LOCALISATEUR de la référence, dont la forme dépend
  -- de reference_kind (CHECK source_url_form_by_kind, plus bas) :
  --   PUBLICATION · PROFILE · QUERY_CONTEXT → URL HTTP(S)
  --   DOCUMENT                              → objet R2 gouverné, r2://<bucket>/<clé>
  --   OTHER                                 → URI à schéma (RFC 3986), jamais de prose
  -- Non vide, sans blanc de bord, jamais une valeur inventée. Un renommage en
  -- `source_locator` est envisageable APRÈS le RC ; d'ici là, tout lecteur
  -- doit lire cette colonne comme un localisateur, pas comme « une URL ».
  source_url            TEXT NOT NULL
                        CONSTRAINT evidence_provenance_journal_source_url_check
                        CHECK (source_url <> '' AND btrim(source_url) = source_url),

  -- ── QUI affirme, et QUAND selon lui. Toute ligne est un acte signé. Non
  -- vide, sans blanc de bord.
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

  -- ── (ex-COHÉRENCE 2, unknown_has_no_reference : SUPPRIMÉE par 4a. UNKNOWN
  -- n'existe plus dans la table, et le NOT NULL de reference_kind et
  -- source_url porte désormais l'invariant « une ligne a une référence ».)

  -- ── COHÉRENCE 1bis : la FORME du localisateur suit la NATURE de la référence.
  -- Ruling Q4 : « Ne faites pas un CHECK global ^https?:// ». Un CASE par
  -- reference_kind ; ELSE false ferme le CASE (toute valeur hors domaine est
  -- déjà refusée par reference_kind_check, mais le CASE ne suppose rien).
  --
  --   PUBLICATION · PROFILE · QUERY_CONTEXT — URL HTTP(S) :
  --     ^https?://<hôte avec au moins un point, sans / ni blanc>(/<reste sans blanc>)?$
  --     · schéma en minuscules, à dessein : la valeur déclarée est CANONIQUE,
  --       pas ce qu'un opérateur a tapé. « HTTPS://… » est refusé.
  --     · aucun blanc nulle part : une « URL » avec une espace n'est pas une
  --       URL (RFC 3986). FAIT MESURÉ : la valeur réelle de "sourceUrl" des
  --       deux pièces VINE, `https://x.com/search?q=from:0xSweep VINE`, porte
  --       une espace et ÉCHOUE cette forme. Une ligne de journal pour VINE
  --       devra porter l'URL encodée (`%20`). Ce n'est pas un backfill : rien
  --       n'est réécrit, et "CaseFileSource"."sourceUrl" n'est plus une preuve.
  --     · hôte avec un point : refuse `localhost`, un nom nu, une IP tronquée.
  --
  --   CE QUE CE CHECK NE DIT PAS, ET QU'ON REFUSE DE FAIRE SEMBLANT DE DIRE :
  --     « INDIVIDUELLE » pour PUBLICATION n'est PAS exprimable structurellement.
  --     Une URL de post individuel n'a pas de forme universelle : x.com/<u>/status/<id>,
  --     t.me/<c>/<id>, un permalien Discord, un article… Un motif qui
  --     accepterait `/status/\d+` et refuserait le reste serait FAUX (il
  --     exclurait les autres plateformes) ou VIDE (il accepterait tout). Un
  --     motif négatif (« pas /search? ») ferait semblant : une page de fil
  --     filtré n'a pas `/search?` et n'est pas un post. L'individualité
  --     d'une PUBLICATION est établie par la VÉRIFICATION — c'est exactement
  --     ce que verification_method = URL_MATCHES_CAPTURED_POST atteste : l'URL
  --     ouverte affiche LE post de la pièce. Avant vérification, c'est une
  --     déclaration (OPERATOR_DECLARED / EXTRACTED) dont le reference_kind
  --     engage son auteur. Cette règle vit dans le code gouverné du vertical
  --     slice, prouvée par test — pas ici en prose.
  --     De même, QUERY_CONTEXT n'exige pas `?q=` : un fil filtré, une page de
  --     hashtag, un flux « from: » sans paramètre sont des contextes de
  --     découverte sans query string. Le motif est le même que PUBLICATION ;
  --     ce qui les sépare est la NATURE déclarée, et 4b (jamais VERIFIED).
  --
  --   DOCUMENT — UNE forme, et une seule : r2://<bucket>/<storage_key>
  --     ^r2://[a-z0-9][a-z0-9-]{1,61}[a-z0-9]/<clé sans blanc>$
  --     · c'est le couple (bucket, storage_key) du registre governed_objects
  --       (index unique sur ces deux colonnes), rendu en URI. Un DOCUMENT
  --       journalisable est un objet GOUVERNÉ ; un fichier qui n'est pas dans
  --       R2 n'est pas journalisable comme DOCUMENT tant qu'il n'y est pas.
  --     · bucket : règles de nommage R2/S3 (3 à 63 caractères, minuscules,
  --       chiffres, tirets, ni au début ni à la fin).
  --     · refusés, à dessein : un chemin local (/Users/…, propre à une machine),
  --       une URL publique pub-….r2.dev (c'est une PUBLICATION du bucket, pas
  --       son identité gouvernée), un URN nu, une prose.
  --
  --   OTHER — un URI à schéma (RFC 3986) : ^<schéma>:<reste sans blanc>$
  --     · OTHER nomme une nature qui ne tient dans aucun domaine ; son
  --       localisateur est au moins un URI. Refuse « voir le dossier ».
  --     · c'est un sur-ensemble des autres formes, à dessein : OTHER ne
  --       renseigne pas la forme, il renseigne l'aveu que la nature est autre.
  CONSTRAINT evidence_provenance_journal_source_url_form_by_kind_check
    CHECK (
      CASE reference_kind
        WHEN 'PUBLICATION'   THEN source_url ~ '^https?://[^/[:space:]]+\.[^/[:space:]]+(/[^[:space:]]*)?$'
        WHEN 'PROFILE'       THEN source_url ~ '^https?://[^/[:space:]]+\.[^/[:space:]]+(/[^[:space:]]*)?$'
        WHEN 'QUERY_CONTEXT' THEN source_url ~ '^https?://[^/[:space:]]+\.[^/[:space:]]+(/[^[:space:]]*)?$'
        WHEN 'DOCUMENT'      THEN source_url ~ '^r2://[a-z0-9][a-z0-9-]{1,61}[a-z0-9]/[^[:space:]]+$'
        WHEN 'OTHER'         THEN source_url ~ '^[a-z][a-z0-9+.-]*:[^[:space:]]+$'
        ELSE false
      END
    ),

  -- ── COHÉRENCE 2 (4b, conservée) : « Discovery context is not source
  -- provenance. » Un contexte de découverte peut être déclaré ou extrait —
  -- jamais VÉRIFIÉ comme source : ce qu'on vérifierait, c'est que la
  -- recherche retrouve le post, pas que la pièce vient de là.
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
  'T2-PROVENANCE-JOURNAL (amende T1 2026-09-14, decisions 4a/4b/5). Journal APPEND-ONLY de la '
  'provenance d''une piece ("EvidenceSnapshot") et AUTORITE sur cette provenance. Le dernier etat '
  'connu = max(id) par evidence_snapshot_id ; une requalification est une NOUVELLE ligne, jamais un '
  'UPDATE. UNKNOWN n''est PAS une valeur de la table : l''absence de ligne VAUT UNKNOWN, derive a la '
  'lecture. Aucun backfill. Toute ligne porte une reference et sa nature ; source_url est un SOURCE '
  'LOCATOR dont la forme suit reference_kind (URL HTTP(S) / objet r2:// / URI). Un QUERY_CONTEXT '
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
--     ni "CaseFileSource"."sourceUrl" pour combler : ce serait l'inférence que
--     le ruling refuse, et depuis la décision 5 ces colonnes ne sont plus une
--     preuve autonome de provenance.
--
-- Toutes les pièces, avec UNKNOWN pour celles sans ligne :
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
--   Le COALESCE vers 'UNKNOWN' est désormais la SEULE façon dont UNKNOWN
--   existe : une valeur DÉRIVÉE de l'absence de ligne, jamais une valeur
--   stockée. Le CHECK de provenance_kind garantit qu'aucun SELECT sur la table
--   ne rendra jamais 'UNKNOWN' autrement que par ce COALESCE.
--
-- Une requalification = INSERT d'une nouvelle ligne (même evidence_snapshot_id,
-- id supérieur). L'ancienne reste lisible : ORDER BY id pour l'historique.
-- Retirer une qualification n'existe pas : on ne « redescend » pas à UNKNOWN,
-- on apporte une qualification moins forte (une nouvelle ligne
-- OPERATOR_DECLARED après une VERIFIED contestée, par exemple), signée et datée.

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS POSE — à exécuter, et à LIRE
-- ═══════════════════════════════════════════════════════════════════════════
--   npx tsx scripts/casefile/verifier-provenance-journal-schema.ts
--   → 0 conforme · 2 table absente · 3 écarts nommés
--
-- Le POST-CHECK, en une seule requête, est le SECOND BLOC à coller après le
-- COMMIT ci-dessus : docs/prep/POSTCHECK_PROVENANCE_JOURNAL_2026-09-14.sql.
-- Une ligne par point vérifié, colonne ok = true partout ou la pose n'est pas
-- conforme. Lecture seule. Le harnais PGlite le rejoue et prouve qu'il sait
-- rougir (une ligne ok = false par sabotage).
-- Attendu : 12 colonnes · 1 PK · 10 CHECK · 1 FK · 1 index cible · 2 triggers
-- activés (tgenabled = 'O') · 0 ligne. Le filtre contype <> 'n' est
-- INDISPENSABLE : PG18 expose les NOT NULL dans pg_constraint, PG 17.11 (la
-- production) non — sans lui, le compte de contraintes dépendrait de la version.
