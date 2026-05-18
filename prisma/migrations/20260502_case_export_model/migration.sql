-- IOC Export Center — Chantier F
-- Apply in Neon SQL Editor. Additive only, no DROP, no destructive ALTER.

DO $$ BEGIN
  CREATE TYPE "CaseExportFormat" AS ENUM (
    'CSV_FULL',
    'JSON_STRUCTURED',
    'STIX_LIKE_JSON',
    'POLICE_ANNEX_PDF',
    'THREAT_INTEL_CSV'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "CaseExport" (
  "id"                   TEXT          NOT NULL,
  "caseId"               TEXT          NOT NULL,
  "workspaceId"          TEXT          NOT NULL,
  "investigatorAccessId" TEXT          NOT NULL,
  "exportFormat"         "CaseExportFormat" NOT NULL,
  "exportedBy"           TEXT          NOT NULL,
  "includedCounts"       JSONB         NOT NULL DEFAULT '{}',
  "publishabilityFilter" TEXT[]        NOT NULL DEFAULT '{}',
  "contentHashSha256"    TEXT          NOT NULL,
  "iocCount"             INTEGER       NOT NULL DEFAULT 0,
  "snapshotCount"        INTEGER       NOT NULL DEFAULT 0,
  "privateExcluded"      INTEGER       NOT NULL DEFAULT 0,
  "createdAt"            TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CaseExport_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CaseExport"
  ADD CONSTRAINT "CaseExport_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "VaultCase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "CaseExport_caseId_idx"               ON "CaseExport"("caseId");
CREATE INDEX IF NOT EXISTS "CaseExport_workspaceId_idx"           ON "CaseExport"("workspaceId");
CREATE INDEX IF NOT EXISTS "CaseExport_investigatorAccessId_idx"  ON "CaseExport"("investigatorAccessId");
