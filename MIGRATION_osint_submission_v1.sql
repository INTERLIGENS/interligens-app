-- ════════════════════════════════════════════════════════════════════
-- MIGRATION: OSINT Submission — provenance & statut (Sprint A0, ADDITIF seul)
-- ════════════════════════════════════════════════════════════════════
-- STATUT : *** NON APPLIQUÉE *** — fichier de référence uniquement.
--          À lancer manuellement par David dans le Neon SQL Editor
--          (ep-square-band). JAMAIS via prisma db push.
--
-- Pourquoi : les contrats Sprint A0 (src/lib/osint/contracts/) définissent une
-- ProvenanceRecord + un SubmissionStatus qui n'ont AUCUN foyer de persistance
-- aujourd'hui. EvidenceSnapshot porte déjà sha256 / extractionMethod /
-- extractionConfidence, mais rien ne trace : qui a soumis, sous quel trustTier,
-- les 2 passes vision brutes, le pHash, et l'état de la soumission.
-- Cette table additive OsintSubmission comble ce trou. Elle ne touche, ne
-- supprime, ne renomme RIEN de l'existant.
--
-- Tant que NON appliquée : NE PAS l'ajouter à prisma/schema.prod.prisma
-- (anti-drift : le schema reflète la base réelle). Le sprint A0 ne fournit que
-- les TYPES ; la persistance arrive dans un sprint ultérieur, une fois la table
-- créée par David.
--
-- Baseline (pour contrôle post-apply) : table absente avant migration.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "OsintSubmission" (
  "id"                 TEXT PRIMARY KEY,

  -- Statut de soumission — cf. SubmissionStatus (src/lib/osint/contracts/status.ts)
  "status"             TEXT NOT NULL DEFAULT 'SUBMITTED',

  -- ── Provenance (cf. ProvenanceRecord) ──────────────────────────────
  "imageSha256"        TEXT NOT NULL,          -- dédup forte ; joint EvidenceSnapshot.sha256
  "perceptualHash"     TEXT,                   -- pHash near-dup ; NULL si non calculé
  "promptVersion"      TEXT,                   -- ex 'vision_v1'
  "modelVersion"       TEXT,                   -- ex 'claude-sonnet-4-5'
  "sourceType"         TEXT NOT NULL DEFAULT 'osint_screenshot',
  "trustTier"          TEXT NOT NULL DEFAULT 'anonymous_retail',  -- cf. SourceTrustTier
  "submitter"          TEXT,                   -- IP-hash (anon) ou userId
  "rawVisionPass1"     JSONB,                  -- JSON brut passe 1 (audit)
  "rawVisionPass2"     JSONB,                  -- JSON brut passe 2 ; NULL si simple lecture
  "decisionReasons"    JSONB,                  -- string[] (warnings + raisons décision)

  -- ── Décision / revue ───────────────────────────────────────────────
  "claimsCount"        INTEGER NOT NULL DEFAULT 0,
  "pendingReason"      TEXT,                   -- cf. PendingReason (si status=PENDING_REVIEW)
  "rejectReason"       TEXT,                   -- cf. RejectReason  (si status=*_REJECTED)
  "evidenceSnapshotId" TEXT,                   -- lien souple vers la preuve commitée (shadow)

  -- ── Horodatage ─────────────────────────────────────────────────────
  "ingestedAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),  -- ProvenanceRecord.ingestedAt (UTC)
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- sha256 volontairement NON-UNIQUE : la détection de doublon passe par une
-- lecture préalable qui pose status='DUPLICATE' (on garde la trace de la
-- re-soumission plutôt que de lever une contrainte). Index pour le lookup.
CREATE INDEX IF NOT EXISTS "OsintSubmission_imageSha256_idx" ON "OsintSubmission" ("imageSha256");
CREATE INDEX IF NOT EXISTS "OsintSubmission_status_idx"      ON "OsintSubmission" ("status");
CREATE INDEX IF NOT EXISTS "OsintSubmission_perceptualHash_idx" ON "OsintSubmission" ("perceptualHash");

-- ════════════════════════════════════════════════════════════════════
-- FIN — aucune autre table, aucune colonne sur l'existant, aucune suppression.
-- ════════════════════════════════════════════════════════════════════
