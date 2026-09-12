-- ═══════════════════════════════════════════════════════════════════════════
-- E-RC · LE REGISTRE D'OBJETS GOUVERNÉS — DDL ADDITIF
-- Fichier : docs/prep/MIGRATION_REGISTRE_OBJETS_GOUVERNES_2026-09-12.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ NON APPLIQUÉ. À coller dans l'ÉDITEUR SQL NEON, après snapshot de branche.
--    JAMAIS `prisma db push`, JAMAIS `prisma migrate` — les deux schemas
--    portent le verrou A9 et s'arrêtent sur P1012 avant tout accès réseau.
--
-- ⚠️ ORDRE DE POSE. Cette table doit exister AVANT que le code qui l'interroge
--    soit déployé. Sans elle :
--      · `uploadPdf` lève TABLE_ABSENTE avant tout PutObject — aucun objet
--        n'est écrit hors registre, ce qui est le comportement voulu (D5),
--        mais /api/pdf/casefile rend alors 500 au lieu de produire un dossier ;
--      · le gate de délivrance refuse toute clé sous `reports/` (fail-closed).
--    Le `pointers/` de /api/pdf/{handle} n'est PAS affecté : il est hors
--    périmètre de phase 1 et passe sans interroger le registre.
--
-- ADDITIF ET SEULEMENT ADDITIF : aucune table existante n'est touchée, aucune
-- colonne supprimée, aucune donnée réécrite.

CREATE TABLE IF NOT EXISTS governed_objects (
  -- L'identifiant EST le nom du fichier dans la clé allouée. C'est ce qui
  -- permet de recoller un objet à sa ligne même si la clé a été altérée.
  id                  TEXT PRIMARY KEY,

  bucket              TEXT NOT NULL,
  storage_key         TEXT NOT NULL,

  -- ── Les faces du contrat. Domaines FERMÉS.
  -- La DÉFINITION du domaine vit dans src/lib/storage/registre/contrat.ts ;
  -- ces CHECK en sont la seconde barrière, pas la source. Si le TypeScript
  -- admet un jour une valeur que le CHECK refuse, l'INSERT échoue — bruyant,
  -- donc corrigeable. L'inverse (le CHECK plus permissif) est le cas qu'on
  -- refuse : une valeur écrite à la main que rien ne verrait passer.
  object_nature       TEXT NOT NULL CHECK (object_nature IN (
                        'CASEFILE_RENDER','KOL_REPORT_ARCHIVE','KOL_REPORT_POINTER',
                        'EVIDENCE_CAPTURE','ADMIN_DOCUMENT','LEGACY_UNCLASSIFIED')),
  provenance          TEXT NOT NULL CHECK (provenance IN (
                        'GOVERNED_PIPELINE','CLIENT_PRESIGNED_UPLOAD','SEED',
                        'MIGRATED_BACKFILL','UNKNOWN_PREEXISTING')),
  authority_state     TEXT NOT NULL CHECK (authority_state IN (
                        'INTENDED','STORED_UNCONFIRMED','REGISTERED',
                        'ABANDONED','ORPHAN_CONFIRMED','LEGACY_UNREGISTERED')),

  -- Le JUGEMENT vit sur sa propre face. `INVALIDATED` n'est délibérément PAS
  -- un `authority_state` : la même vérité dans deux colonnes divergerait.
  invalidation_state  TEXT NOT NULL DEFAULT 'NONE' CHECK (invalidation_state IN (
                        'NONE','INVALID_AUTHORITY','SUPERSEDED','WITHDRAWN_BY_DECISION')),
  invalidation_reason TEXT,
  invalidated_at      TIMESTAMPTZ,
  invalidated_by      TEXT,

  -- D2 — une DÉCISION enregistrée. Aucun mécanisme ne l'applique : ce
  -- compartiment n'est pas WORM, aucun object lock n'est en vigueur, et
  -- l'absence de politique de cycle de vie n'est pas une politique de
  -- conservation. La colonne rend la décision EXPLICITE, rien de plus.
  retention_class     TEXT NOT NULL CHECK (retention_class IN (
                        'EVIDENTIARY_INDEFINITE','OPERATIONAL_ROLLING','UNCLASSIFIED_LEGACY')),

  -- L'identité SÉMANTIQUE vit ici, et plus dans la clé. Une clé voyage : elle
  -- est le chemin d'une URL signée remise à un tiers.
  subject             TEXT NOT NULL,
  batch_id            TEXT,

  -- L'intégrité. Vérifiée par HeadObject (taille + métadonnée sha256), jamais
  -- par l'ETag — qui n'est pas un MD5 en multipart — et jamais par GetObject,
  -- qui ferait sortir les octets du compartiment pour les comparer.
  --
  -- NULLABLES, et c'est une exigence d'HONNÊTETÉ, pas une commodité : une
  -- ligne ALLOUÉE porte toujours son empreinte (le buffer est en main avant le
  -- PUT), mais une ligne née de l'OBSERVATION — un orphelin qu'on qualifie —
  -- ne le peut pas. L'établir exigerait de lire les octets. NULL dit « non
  -- établi » ; une valeur inventée dirait « vérifié ».
  sha256              TEXT,
  size_bytes          INTEGER NOT NULL,
  content_type        TEXT,

  producer            TEXT NOT NULL,

  -- Une SEULE horloge pour l'ordre des faits : celle de la base. Deux horloges
  -- (application + base) rendraient l'antériorité de deux lignes dépendante
  -- d'une dérive qu'aucune des deux ne mesure.
  allocated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  registered_at       TIMESTAMPTZ,
  last_reconciled_at  TIMESTAMPTZ,
  reconcile_note      TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- F6 — l'écrasement silencieux d'une archive dite immuable devient une ERREUR.
-- Sous l'ancienne forme de clé, deux tirages des MÊMES octets dans la MÊME
-- milliseconde produisaient la même clé, et le second écrasait le premier.
CREATE UNIQUE INDEX IF NOT EXISTS governed_objects_bucket_key_uniq
  ON governed_objects (bucket, storage_key);

-- P3 — la détection des états non terminaux au-delà de l'échéance T.
CREATE INDEX IF NOT EXISTS governed_objects_state_allocated_idx
  ON governed_objects (authority_state, allocated_at);

CREATE INDEX IF NOT EXISTS governed_objects_subject_idx ON governed_objects (subject);

-- Non UNIQUE, à dessein : deux tirages légitimes du même dossier produisent
-- les mêmes octets. L'unicité porte sur la clé, jamais sur le contenu.
CREATE INDEX IF NOT EXISTS governed_objects_sha256_idx ON governed_objects (sha256);

COMMENT ON TABLE governed_objects IS
  'E-RC. Registre d''autorite des objets gouvernes. L''eligibilite a publication '
  'n''est PAS ici : elle se DERIVE des cinq faces (src/lib/storage/registre/eligibilite.ts). '
  'Une colonne d''eligibilite serait une seconde source de verite.';

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS POSE — à exécuter, et à LIRE
-- ═══════════════════════════════════════════════════════════════════════════
-- Un message de commit sur l'état de la base n'est pas une source de vérité.
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'governed_objects'
--    ORDER BY ordinal_position;
--
--   SELECT indexname FROM pg_indexes WHERE tablename = 'governed_objects';
