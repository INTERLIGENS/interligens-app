-- ════════════════════════════════════════════════════════════════════
-- MIGRATION: OSINT Retail Gate — privacy + retail provenance (Sprint C1, ADDITIF)
-- ════════════════════════════════════════════════════════════════════
-- STATUT : *** NON APPLIQUÉE *** — fichier de référence uniquement.
--          À lancer manuellement par David dans le Neon SQL Editor
--          (ep-square-band). JAMAIS via prisma db push.
--
-- Prérequis : MIGRATION_osint_submission_v1.sql (table OsintSubmission) appliquée
-- d'abord. Cette migration AJOUTE des colonnes à OsintSubmission pour la porte
-- retail publique (Sprint C1). Elle ne touche, ne supprime, ne renomme RIEN.
--
-- Pourquoi : la soumission retail anonyme exige (exigence GPT gated beta) :
--   1. une garantie PRIVACY dure : l'image originale retail n'est JAMAIS publique,
--      même après validation humaine → privacyStatus (défaut never_public_raw).
--   2. la séparation original (privé, conservé par hash) vs version normalisée
--      (compressée, la SEULE envoyée à la vision) → normalizedSha256/Bytes/B64.
--   3. le groupage d'un envoi (1-3 captures = 1 batch) → batchId.
--   4. la traçabilité retail (tweet, contexte, dimensions, précheck).
--
-- Tant que NON appliquée : NE PAS l'ajouter à prisma/schema.prod.prisma
-- (anti-drift). La porte retail reste FERMÉE par défaut (kill switch
-- OSINT_RETAIL_SUBMIT_ENABLED=false) ; rien n'écrit en prod ce sprint.
--
-- Baseline (contrôle post-apply) : colonnes ci-dessous absentes avant migration.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE "OsintSubmission"
  -- ── Groupage d'envoi ────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS "batchId"            TEXT,            -- 1 submit (1-3 captures) = 1 batchId partagé ; = submissionId rendu au client

  -- ── PRIVACY (exigence GPT — garantie dure) ──────────────────────────
  -- raw_private | pii_scan_pending | pii_redacted | safe_for_admin_review | never_public_raw
  ADD COLUMN IF NOT EXISTS "privacyStatus"      TEXT NOT NULL DEFAULT 'never_public_raw',

  -- ── Original (PRIVÉ — jamais public, jamais écrasé) ──────────────────
  ADD COLUMN IF NOT EXISTS "originalBytes"      INTEGER,         -- taille brute du fichier reçu
  ADD COLUMN IF NOT EXISTS "rawImageStored"     BOOLEAN NOT NULL DEFAULT false, -- bytes persistés dans le coffre privé (R2) ?
  ADD COLUMN IF NOT EXISTS "rawImageRef"        TEXT,            -- clé coffre privé (R2), NULL si non persisté (hash seul conservé)

  -- ── Version normalisée (la SEULE envoyée à la vision) ───────────────
  ADD COLUMN IF NOT EXISTS "normalizedSha256"   TEXT,            -- hash de la version compressée
  ADD COLUMN IF NOT EXISTS "normalizedBytes"    INTEGER,         -- taille de la version compressée (cible <= 4.5 MB)
  ADD COLUMN IF NOT EXISTS "normalizedMediaType" TEXT,           -- image/jpeg | image/webp
  ADD COLUMN IF NOT EXISTS "normalizedImageB64" TEXT,            -- base64 de la version normalisée (chemin de récupération async sans R2 ; C2 -> R2)

  -- ── Provenance retail ───────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS "extractionMethod"   TEXT,            -- 'vision_retail_auto'
  ADD COLUMN IF NOT EXISTS "tweetUrl"           TEXT,            -- URL tweet optionnelle fournie par le soumetteur
  ADD COLUMN IF NOT EXISTS "contextNote"        TEXT,            -- contexte libre optionnel (tronqué)
  ADD COLUMN IF NOT EXISTS "imageIndex"         INTEGER,         -- position 0-based dans le batch
  ADD COLUMN IF NOT EXISTS "imageCount"         INTEGER,         -- taille du batch (1-3)
  ADD COLUMN IF NOT EXISTS "width"              INTEGER,
  ADD COLUMN IF NOT EXISTS "height"             INTEGER,
  ADD COLUMN IF NOT EXISTS "turnstileVerified"  BOOLEAN,         -- token Turnstile validé (NULL si Turnstile non configuré)
  ADD COLUMN IF NOT EXISTS "precheckReason"     TEXT;            -- cf. RejectReason (si status=PRECHECK_REJECTED)

-- Lookup rate-limit IP (submitter = IP-hash) + fenêtre temporelle.
CREATE INDEX IF NOT EXISTS "OsintSubmission_submitter_ingestedAt_idx"
  ON "OsintSubmission" ("submitter", "ingestedAt");
-- Lookup statut par batch (status endpoint public).
CREATE INDEX IF NOT EXISTS "OsintSubmission_batchId_idx"
  ON "OsintSubmission" ("batchId");
-- Dédup near-file sur la version normalisée (complète l'index imageSha256 v1).
CREATE INDEX IF NOT EXISTS "OsintSubmission_normalizedSha256_idx"
  ON "OsintSubmission" ("normalizedSha256");

-- ════════════════════════════════════════════════════════════════════
-- FIN — aucune table créée, aucune colonne supprimée, aucune destruction.
-- Toutes les colonnes sont nullable ou ont un défaut → ADDITIF strict.
-- ════════════════════════════════════════════════════════════════════
