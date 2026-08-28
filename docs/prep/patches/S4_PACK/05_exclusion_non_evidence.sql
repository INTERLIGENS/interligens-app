-- ═══════════════════════════════════════════════════════════════════════════
-- S4 · FICHIER 5/6 — EXCLUSION DE LA CHAÎNE PROBATOIRE ACTIVE · 7 lignes
--
-- R3 RATIFIÉ : un conteneur n'est pas une pièce, un déchet système n'est rien.
-- DOCTRINE « NEVER DELETE » : aucun DELETE. Les 7 artefacts restent en base,
-- avec leur sha256 et leur horodatage, disponibles pour l'audit de provenance.
-- Ils cessent seulement de PARTICIPER aux chaînes de preuve.
--
-- ⚠️ GAP DE SCHÉMA — CE FICHIER LE COMBLE. Vérifié le 2026-08-28 :
-- "EvidenceItem" ne porte AUCUNE colonne de statut, d'activation ou
-- d'exclusion (recherche sur %status%, %activ%, %exclu%, %valid% : 0 résultat).
-- L'exclusion ratifiée était donc INEXPRIMABLE. Deux colonnes additives la
-- rendent exprimable — nullables, SANS DEFAULT, donc instantanées.
--
-- Pourquoi PAS réutiliser une colonne existante : ranger 'EXCLUDED' dans
-- "provenanceType" mélangerait l'origine d'une pièce et son statut probatoire.
-- Deux questions différentes, deux colonnes.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "EvidenceItem" ADD COLUMN IF NOT EXISTS "evidentiaryStatus" text;
ALTER TABLE "EvidenceItem" ADD COLUMN IF NOT EXISTS "exclusionReason"   text;

-- ─── RÈGLES DE LA COLONNE, RATIFIÉES ──────────────────────────────────────
-- • AUCUN DEFAULT. La colonne naît NULL sur les 1 104 lignes.
-- • NULL NE VEUT PAS DIRE « ACTIVE » : NULL veut dire « aucune décision
--   d'exclusion n'a été prononcée sur cette ligne ». On n'écrit PAS 'INCLUDED'
--   sur les 1 097 autres — ce serait affirmer qu'elles sont toutes
--   probatoirement valides, ce que personne n'a établi. 'INCLUDED' ne
--   s'écrira que le jour où un modèle exigera une valeur explicite.
-- • "exclusionReason" est OBLIGATOIRE dès que "evidentiaryStatus" = 'EXCLUDED'.
--   Une exclusion sans motif écrit est une disparition silencieuse. Les deux
--   UPDATE ci-dessous écrivent donc toujours les deux colonnes ensemble, et la
--   vérification en fin de fichier échoue si une exclusion arrive sans motif.

-- ─── 1. Les 5 archives ZIP conteneurs ─────────────────────────────────────
-- Archive.zip, BK DIONE.zip, CAPTURE (X).zip, DONWEDGE.zip, BOTIFY SCAM.zip.
-- Leurs membres sont déjà versés individuellement — 115 lignes portent la
-- mention « membre d'archive ». Le conteneur est donc la même preuve à un
-- autre emplacement. Précédent posé par S3 lui-même en écartant un doublon R2 :
-- « le sha256 est l'identité de la preuve, deux clés pointant les mêmes octets
-- sont une pièce à deux emplacements, pas deux pièces ».
UPDATE "EvidenceItem"
   SET "evidentiaryStatus" = 'EXCLUDED',
       "exclusionReason"   = 'conteneur d''archive ; membres verses individuellement (S4, 2026-08-28)'
 WHERE "evidentiaryStatus" IS NULL
   AND "mimeType" = 'application/zip';                              -- attendu : 5

-- ─── 2. Les 2 fichiers .DS_Store ──────────────────────────────────────────
-- Métadonnée de dossier macOS, aspirée par le balayage récursif des archives.
-- N'atteste rien : ni capture, ni donnée, ni affirmation.
UPDATE "EvidenceItem"
   SET "evidentiaryStatus" = 'EXCLUDED',
       "exclusionReason"   = 'metadonnee de dossier macOS ; aucune affirmation portee (S4, 2026-08-28)'
 WHERE "evidentiaryStatus" IS NULL
   AND "filePath" ILIKE '%.DS_Store';                               -- attendu : 2

-- ─── CE QUE CE FICHIER NE FAIT PAS ────────────────────────────────────────
-- Il n'écrit AUCUN rowNature sur ces 7 lignes : elles restent UNCLASSIFIED,
-- ce qui est cohérent — on ne classe pas ce qu'on exclut. Et il ne modifie
-- aucun code : le filtrage effectif des pièces exclues dans les lectures
-- produit reste à écrire, et c'est signalé comme tel dans le README.

-- ─── VÉRIFICATION 1 — ligne à ligne, 7 lignes ─────────────────────────────
SELECT "sourceType", "mimeType", "filePath", "evidentiaryStatus", "exclusionReason",
       COALESCE("rowNature"::text,'(NULL)') AS nature
  FROM "EvidenceItem" WHERE "evidentiaryStatus" IS NOT NULL
 ORDER BY "mimeType", "filePath";
-- ATTENDU : 7 lignes — 5 application/zip, 2 .DS_Store.
-- rowNature doit valoir UNCLASSIFIED sur les 7. Si l'une porte une nature,
-- un fichier de classement l'a attrapée : ARRÊT, prédicat à revoir.

-- ─── VÉRIFICATION 2 — l'invariant « exclu ⇒ motif écrit » ─────────────────
SELECT count(*)::int AS exclusions_sans_motif
  FROM "EvidenceItem"
 WHERE "evidentiaryStatus" = 'EXCLUDED'
   AND ("exclusionReason" IS NULL OR btrim("exclusionReason") = '');
-- ATTENDU : 0. Toute autre valeur = ARRÊT et rollback de ce fichier.

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────
-- UPDATE "EvidenceItem" SET "evidentiaryStatus" = NULL, "exclusionReason" = NULL
--  WHERE "evidentiaryStatus" = 'EXCLUDED';
-- ALTER TABLE "EvidenceItem" DROP COLUMN IF EXISTS "exclusionReason";
-- ALTER TABLE "EvidenceItem" DROP COLUMN IF EXISTS "evidentiaryStatus";
