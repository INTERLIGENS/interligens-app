-- ============================================================================
-- Migration : Security Center (11 tables)
-- Target    : ep-square-band Neon (production)
-- Safety    : ADDITIVE. Aucune colonne existante modifiée, aucune donnée touchée.
--             Idempotent (IF NOT EXISTS + DO blocks). Wrapped in transaction.
-- Source    : prisma/schema.prod.prisma (modèles SecurityVendor, SecuritySource,
--             SecurityIncident, SecurityExposureAssessment, SecurityAsset,
--             SecurityVendorExposureLink, SecurityActionItem,
--             SecurityWeeklyDigest, SecurityThreatCatalog, SecurityCommsDraft,
--             SecurityAuditLog)
-- ============================================================================
--
-- AVANT DE POSER :
--   1. Neon Console → Branches → ep-square-band → Create snapshot.
--      Label suggéré : "pre-security-center-2026-04-20".
--   2. Ouvre le SQL Editor sur la branche principale (production).
--   3. Colle le bloc entier ci-dessous. Exécute.
--   4. Vérifie les SELECTs à la fin.
--   5. Sur la machine dev : `npx prisma generate --schema=prisma/schema.prod.prisma`.
--   6. Redeploy `npx vercel --prod`.
--
-- En cas de souci : la transaction rollback automatiquement.
-- ============================================================================

BEGIN;

-- ── 1. SecurityVendor ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SecurityVendor" (
  "id"               TEXT         NOT NULL,
  "slug"             TEXT         NOT NULL,
  "name"             TEXT         NOT NULL,
  "category"         TEXT         NOT NULL,
  "isActive"         BOOLEAN      NOT NULL DEFAULT true,
  "websiteUrl"       TEXT,
  "statusPageUrl"    TEXT,
  "rssUrl"           TEXT,
  "atomUrl"          TEXT,
  "webhookSupported" BOOLEAN      NOT NULL DEFAULT false,
  "emailSupported"   BOOLEAN      NOT NULL DEFAULT false,
  "notes"            TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityVendor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SecurityVendor_slug_key"
  ON "SecurityVendor"("slug");
CREATE INDEX IF NOT EXISTS "SecurityVendor_category_idx"
  ON "SecurityVendor"("category");
CREATE INDEX IF NOT EXISTS "SecurityVendor_isActive_idx"
  ON "SecurityVendor"("isActive");

-- ── 2. SecuritySource ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SecuritySource" (
  "id"                  TEXT         NOT NULL,
  "vendorId"            TEXT,
  "sourceType"          TEXT         NOT NULL,
  "name"                TEXT         NOT NULL,
  "url"                 TEXT         NOT NULL,
  "isActive"            BOOLEAN      NOT NULL DEFAULT true,
  "pollIntervalMinutes" INTEGER,
  "lastPolledAt"        TIMESTAMP(3),
  "lastStatus"          TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecuritySource_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SecuritySource_vendorId_idx"
  ON "SecuritySource"("vendorId");
CREATE INDEX IF NOT EXISTS "SecuritySource_sourceType_idx"
  ON "SecuritySource"("sourceType");
CREATE INDEX IF NOT EXISTS "SecuritySource_isActive_idx"
  ON "SecuritySource"("isActive");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'SecuritySource_vendorId_fkey') THEN
    ALTER TABLE "SecuritySource"
      ADD CONSTRAINT "SecuritySource_vendorId_fkey"
      FOREIGN KEY ("vendorId") REFERENCES "SecurityVendor"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- ── 3. SecurityIncident ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SecurityIncident" (
  "id"           TEXT         NOT NULL,
  "vendorId"     TEXT,
  "sourceId"     TEXT,
  "externalId"   TEXT,
  "title"        TEXT         NOT NULL,
  "summaryShort" TEXT         NOT NULL,
  "summaryLong"  TEXT,
  "incidentType" TEXT         NOT NULL,
  "severity"     TEXT         NOT NULL,
  "status"       TEXT         NOT NULL DEFAULT 'open',
  "detectedAt"   TIMESTAMP(3) NOT NULL,
  "occurredAt"   TIMESTAMP(3),
  "resolvedAt"   TIMESTAMP(3),
  "sourceUrl"    TEXT,
  "rawPayload"   JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityIncident_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SecurityIncident_vendorId_externalId_key"
  ON "SecurityIncident"("vendorId", "externalId");
CREATE INDEX IF NOT EXISTS "SecurityIncident_status_idx"
  ON "SecurityIncident"("status");
CREATE INDEX IF NOT EXISTS "SecurityIncident_severity_idx"
  ON "SecurityIncident"("severity");
CREATE INDEX IF NOT EXISTS "SecurityIncident_detectedAt_idx"
  ON "SecurityIncident"("detectedAt" DESC);
CREATE INDEX IF NOT EXISTS "SecurityIncident_vendorId_idx"
  ON "SecurityIncident"("vendorId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'SecurityIncident_vendorId_fkey') THEN
    ALTER TABLE "SecurityIncident"
      ADD CONSTRAINT "SecurityIncident_vendorId_fkey"
      FOREIGN KEY ("vendorId") REFERENCES "SecurityVendor"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'SecurityIncident_sourceId_fkey') THEN
    ALTER TABLE "SecurityIncident"
      ADD CONSTRAINT "SecurityIncident_sourceId_fkey"
      FOREIGN KEY ("sourceId") REFERENCES "SecuritySource"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- ── 4. SecurityExposureAssessment ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SecurityExposureAssessment" (
  "id"                      TEXT         NOT NULL,
  "incidentId"              TEXT         NOT NULL,
  "exposureLevel"           TEXT         NOT NULL,
  "affectedSurface"         JSONB        NOT NULL,
  "requiresKeyRotation"     BOOLEAN      NOT NULL DEFAULT false,
  "requiresAccessReview"    BOOLEAN      NOT NULL DEFAULT false,
  "requiresInfraLogReview"  BOOLEAN      NOT NULL DEFAULT false,
  "requiresPublicStatement" BOOLEAN      NOT NULL DEFAULT false,
  "actionChecklist"         JSONB        NOT NULL,
  "analystNote"             TEXT,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityExposureAssessment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SecurityExposureAssessment_incidentId_idx"
  ON "SecurityExposureAssessment"("incidentId");
CREATE INDEX IF NOT EXISTS "SecurityExposureAssessment_exposureLevel_idx"
  ON "SecurityExposureAssessment"("exposureLevel");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'SecurityExposureAssessment_incidentId_fkey') THEN
    ALTER TABLE "SecurityExposureAssessment"
      ADD CONSTRAINT "SecurityExposureAssessment_incidentId_fkey"
      FOREIGN KEY ("incidentId") REFERENCES "SecurityIncident"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- ── 5. SecurityAsset ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SecurityAsset" (
  "id"          TEXT         NOT NULL,
  "assetType"   TEXT         NOT NULL,
  "name"        TEXT         NOT NULL,
  "externalRef" TEXT,
  "environment" TEXT         NOT NULL DEFAULT 'prod',
  "isCritical"  BOOLEAN      NOT NULL DEFAULT false,
  "owner"       TEXT,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SecurityAsset_assetType_idx"
  ON "SecurityAsset"("assetType");
CREATE INDEX IF NOT EXISTS "SecurityAsset_environment_idx"
  ON "SecurityAsset"("environment");
CREATE INDEX IF NOT EXISTS "SecurityAsset_isCritical_idx"
  ON "SecurityAsset"("isCritical");

-- ── 6. SecurityVendorExposureLink ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SecurityVendorExposureLink" (
  "id"               TEXT NOT NULL,
  "vendorId"         TEXT NOT NULL,
  "assetId"          TEXT NOT NULL,
  "relationshipType" TEXT NOT NULL,
  CONSTRAINT "SecurityVendorExposureLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SecurityVendorExposureLink_vendorId_assetId_relationshipType_key"
  ON "SecurityVendorExposureLink"("vendorId", "assetId", "relationshipType");
CREATE INDEX IF NOT EXISTS "SecurityVendorExposureLink_vendorId_idx"
  ON "SecurityVendorExposureLink"("vendorId");
CREATE INDEX IF NOT EXISTS "SecurityVendorExposureLink_assetId_idx"
  ON "SecurityVendorExposureLink"("assetId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'SecurityVendorExposureLink_vendorId_fkey') THEN
    ALTER TABLE "SecurityVendorExposureLink"
      ADD CONSTRAINT "SecurityVendorExposureLink_vendorId_fkey"
      FOREIGN KEY ("vendorId") REFERENCES "SecurityVendor"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'SecurityVendorExposureLink_assetId_fkey') THEN
    ALTER TABLE "SecurityVendorExposureLink"
      ADD CONSTRAINT "SecurityVendorExposureLink_assetId_fkey"
      FOREIGN KEY ("assetId") REFERENCES "SecurityAsset"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- ── 7. SecurityActionItem ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SecurityActionItem" (
  "id"          TEXT         NOT NULL,
  "incidentId"  TEXT,
  "title"       TEXT         NOT NULL,
  "description" TEXT         NOT NULL,
  "priority"    TEXT         NOT NULL DEFAULT 'p3',
  "status"      TEXT         NOT NULL DEFAULT 'todo',
  "owner"       TEXT,
  "dueAt"       TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityActionItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SecurityActionItem_status_idx"
  ON "SecurityActionItem"("status");
CREATE INDEX IF NOT EXISTS "SecurityActionItem_priority_idx"
  ON "SecurityActionItem"("priority");
CREATE INDEX IF NOT EXISTS "SecurityActionItem_incidentId_idx"
  ON "SecurityActionItem"("incidentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'SecurityActionItem_incidentId_fkey') THEN
    ALTER TABLE "SecurityActionItem"
      ADD CONSTRAINT "SecurityActionItem_incidentId_fkey"
      FOREIGN KEY ("incidentId") REFERENCES "SecurityIncident"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- ── 8. SecurityWeeklyDigest ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SecurityWeeklyDigest" (
  "id"                    TEXT         NOT NULL,
  "periodStart"           TIMESTAMP(3) NOT NULL,
  "periodEnd"             TIMESTAMP(3) NOT NULL,
  "generatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "subject"               TEXT         NOT NULL,
  "bodyHtml"              TEXT         NOT NULL,
  "bodyText"              TEXT         NOT NULL,
  "includedIncidentCount" INTEGER      NOT NULL DEFAULT 0,
  "includedCriticalCount" INTEGER      NOT NULL DEFAULT 0,
  "deliveryStatus"        TEXT         NOT NULL DEFAULT 'pending',
  "deliveryMeta"          JSONB,
  "sentAt"                TIMESTAMP(3),
  CONSTRAINT "SecurityWeeklyDigest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SecurityWeeklyDigest_generatedAt_idx"
  ON "SecurityWeeklyDigest"("generatedAt" DESC);
CREATE INDEX IF NOT EXISTS "SecurityWeeklyDigest_deliveryStatus_idx"
  ON "SecurityWeeklyDigest"("deliveryStatus");

-- ── 9. SecurityThreatCatalog ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SecurityThreatCatalog" (
  "id"            TEXT         NOT NULL,
  "slug"          TEXT         NOT NULL,
  "title"         TEXT         NOT NULL,
  "description"   TEXT         NOT NULL,
  "category"      TEXT         NOT NULL,
  "targetSurface" TEXT         NOT NULL,
  "examples"      JSONB,
  "mitigation"    JSONB,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityThreatCatalog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SecurityThreatCatalog_slug_key"
  ON "SecurityThreatCatalog"("slug");
CREATE INDEX IF NOT EXISTS "SecurityThreatCatalog_category_idx"
  ON "SecurityThreatCatalog"("category");

-- ── 10. SecurityCommsDraft ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SecurityCommsDraft" (
  "id"         TEXT         NOT NULL,
  "incidentId" TEXT,
  "channel"    TEXT         NOT NULL,
  "tone"       TEXT         NOT NULL,
  "title"      TEXT,
  "body"       TEXT         NOT NULL,
  "status"     TEXT         NOT NULL DEFAULT 'draft',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityCommsDraft_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SecurityCommsDraft_incidentId_idx"
  ON "SecurityCommsDraft"("incidentId");
CREATE INDEX IF NOT EXISTS "SecurityCommsDraft_status_idx"
  ON "SecurityCommsDraft"("status");
CREATE INDEX IF NOT EXISTS "SecurityCommsDraft_channel_idx"
  ON "SecurityCommsDraft"("channel");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'SecurityCommsDraft_incidentId_fkey') THEN
    ALTER TABLE "SecurityCommsDraft"
      ADD CONSTRAINT "SecurityCommsDraft_incidentId_fkey"
      FOREIGN KEY ("incidentId") REFERENCES "SecurityIncident"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- ── 11. SecurityAuditLog ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SecurityAuditLog" (
  "id"         TEXT         NOT NULL,
  "actorType"  TEXT         NOT NULL,
  "actorId"    TEXT,
  "eventType"  TEXT         NOT NULL,
  "targetType" TEXT         NOT NULL,
  "targetId"   TEXT,
  "metadata"   JSONB,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SecurityAuditLog_actorType_idx"
  ON "SecurityAuditLog"("actorType");
CREATE INDEX IF NOT EXISTS "SecurityAuditLog_eventType_idx"
  ON "SecurityAuditLog"("eventType");
CREATE INDEX IF NOT EXISTS "SecurityAuditLog_targetType_targetId_idx"
  ON "SecurityAuditLog"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "SecurityAuditLog_createdAt_idx"
  ON "SecurityAuditLog"("createdAt" DESC);

COMMIT;

-- ============================================================================
-- Vérifications — toutes les lignes doivent être présentes après COMMIT.
-- ============================================================================
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name LIKE 'Security%'
 ORDER BY table_name;

-- Expected rows:
--   SecurityActionItem
--   SecurityAsset
--   SecurityAuditLog
--   SecurityCommsDraft
--   SecurityExposureAssessment
--   SecurityIncident
--   SecuritySource
--   SecurityThreatCatalog
--   SecurityVendor
--   SecurityVendorExposureLink
--   SecurityWeeklyDigest
