-- ─────────────────────────────────────────────────────────────────────────────
-- INVESTIGATORS VAULT — manual migration
-- Apply via Neon SQL Editor (ep-square-band). Do NOT run prisma db push.
-- Additive only — no existing table or column is altered.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enums
CREATE TYPE "VaultVisibility"  AS ENUM ('PRIVATE','SEMI_PUBLIC','PUBLIC');
CREATE TYPE "VaultCaseStatus"  AS ENUM ('PRIVATE','SHARED_INTERNAL','SUBMITTED','ARCHIVED');
CREATE TYPE "VaultEntityType"  AS ENUM ('WALLET','TX_HASH','HANDLE','URL','DOMAIN','ALIAS','EMAIL','IP','CONTRACT','OTHER');
CREATE TYPE "VaultParseStatus" AS ENUM ('PENDING','PARSED','PARTIAL','MANUAL_REQUIRED','FAILED');

-- VaultInvite
CREATE TABLE "VaultInvite" (
  "id"        TEXT NOT NULL,
  "token"     TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VaultInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VaultInvite_token_key" ON "VaultInvite"("token");

-- VaultProfile
CREATE TABLE "VaultProfile" (
  "id"                   TEXT NOT NULL,
  "investigatorAccessId" TEXT NOT NULL,
  "handle"               TEXT NOT NULL,
  "displayName"          TEXT,
  "bio"                  TEXT,
  "avatarUrl"            TEXT,
  "languages"            TEXT[],
  "specialties"          TEXT[],
  "coverageZones"        TEXT[],
  "websiteUrl"           TEXT,
  "twitterHandle"        TEXT,
  "telegramHandle"       TEXT,
  "contactEmail"         TEXT,
  "visibility"           "VaultVisibility" NOT NULL DEFAULT 'PRIVATE',
  "isFeatured"           BOOLEAN NOT NULL DEFAULT false,
  "isVerified"           BOOLEAN NOT NULL DEFAULT false,
  "badges"               TEXT[],
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VaultProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VaultProfile_investigatorAccessId_key" ON "VaultProfile"("investigatorAccessId");
CREATE UNIQUE INDEX "VaultProfile_handle_key"               ON "VaultProfile"("handle");
ALTER TABLE "VaultProfile"
  ADD CONSTRAINT "VaultProfile_investigatorAccessId_fkey"
  FOREIGN KEY ("investigatorAccessId") REFERENCES "InvestigatorAccess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- VaultNdaAcceptance
CREATE TABLE "VaultNdaAcceptance" (
  "id"                   TEXT NOT NULL,
  "investigatorAccessId" TEXT NOT NULL,
  "profileId"            TEXT,
  "ndaVersion"           TEXT NOT NULL,
  "ndaDocHash"           TEXT NOT NULL,
  "signerName"           TEXT NOT NULL,
  "signedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress"            TEXT,
  CONSTRAINT "VaultNdaAcceptance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VaultNdaAcceptance_investigatorAccessId_key" ON "VaultNdaAcceptance"("investigatorAccessId");
CREATE UNIQUE INDEX "VaultNdaAcceptance_profileId_key"            ON "VaultNdaAcceptance"("profileId");
ALTER TABLE "VaultNdaAcceptance"
  ADD CONSTRAINT "VaultNdaAcceptance_investigatorAccessId_fkey"
  FOREIGN KEY ("investigatorAccessId") REFERENCES "InvestigatorAccess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VaultNdaAcceptance"
  ADD CONSTRAINT "VaultNdaAcceptance_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "VaultProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- VaultWorkspace
CREATE TABLE "VaultWorkspace" (
  "id"            TEXT NOT NULL,
  "profileId"     TEXT NOT NULL,
  "kdfSalt"       TEXT NOT NULL,
  "kdfAlgo"       TEXT NOT NULL DEFAULT 'PBKDF2-SHA256',
  "kdfIterations" INTEGER NOT NULL DEFAULT 310000,
  "encMode"       TEXT NOT NULL DEFAULT 'CLIENT_SIDE_AES256GCM',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VaultWorkspace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VaultWorkspace_profileId_key" ON "VaultWorkspace"("profileId");
ALTER TABLE "VaultWorkspace"
  ADD CONSTRAINT "VaultWorkspace_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "VaultProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- VaultCase
CREATE TABLE "VaultCase" (
  "id"          TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "titleEnc"    TEXT NOT NULL,
  "titleIv"     TEXT NOT NULL,
  "tagsEnc"     TEXT NOT NULL,
  "tagsIv"      TEXT NOT NULL,
  "status"      "VaultCaseStatus" NOT NULL DEFAULT 'PRIVATE',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "archivedAt"  TIMESTAMP(3),
  CONSTRAINT "VaultCase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VaultCase_workspaceId_idx" ON "VaultCase"("workspaceId");
CREATE INDEX "VaultCase_status_idx"      ON "VaultCase"("status");
ALTER TABLE "VaultCase"
  ADD CONSTRAINT "VaultCase_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "VaultWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- VaultCaseEntity
CREATE TABLE "VaultCaseEntity" (
  "id"               TEXT NOT NULL,
  "caseId"           TEXT NOT NULL,
  "type"             "VaultEntityType" NOT NULL,
  "value"            TEXT NOT NULL,
  "label"            TEXT,
  "confidence"       DOUBLE PRECISION,
  "extractionMethod" TEXT,
  "sourceFileId"     TEXT,
  "tigerScore"       INTEGER,
  "tigerVerdict"     TEXT,
  "enrichedAt"       TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VaultCaseEntity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VaultCaseEntity_caseId_type_value_key" ON "VaultCaseEntity"("caseId","type","value");
CREATE INDEX "VaultCaseEntity_caseId_idx"     ON "VaultCaseEntity"("caseId");
CREATE INDEX "VaultCaseEntity_type_value_idx" ON "VaultCaseEntity"("type","value");
ALTER TABLE "VaultCaseEntity"
  ADD CONSTRAINT "VaultCaseEntity_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "VaultCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- VaultCaseFile
CREATE TABLE "VaultCaseFile" (
  "id"            TEXT NOT NULL,
  "caseId"        TEXT NOT NULL,
  "filenameEnc"   TEXT NOT NULL,
  "filenameIv"    TEXT NOT NULL,
  "mimeType"      TEXT NOT NULL,
  "sizeBytes"     INTEGER NOT NULL,
  "uploadedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "r2Key"         TEXT NOT NULL,
  "r2Bucket"      TEXT NOT NULL DEFAULT 'interligens-vaults',
  "parseStatus"   "VaultParseStatus" NOT NULL DEFAULT 'PENDING',
  "parsedAt"      TIMESTAMP(3),
  "entitiesFound" INTEGER NOT NULL DEFAULT 0,
  "parseMode"     TEXT,
  "parseError"    TEXT,
  CONSTRAINT "VaultCaseFile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VaultCaseFile_r2Key_key" ON "VaultCaseFile"("r2Key");
CREATE INDEX "VaultCaseFile_caseId_idx"       ON "VaultCaseFile"("caseId");
ALTER TABLE "VaultCaseFile"
  ADD CONSTRAINT "VaultCaseFile_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "VaultCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- VaultCaseNote
CREATE TABLE "VaultCaseNote" (
  "id"         TEXT NOT NULL,
  "caseId"     TEXT NOT NULL,
  "contentEnc" TEXT NOT NULL,
  "contentIv"  TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VaultCaseNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VaultCaseNote_caseId_idx" ON "VaultCaseNote"("caseId");
ALTER TABLE "VaultCaseNote"
  ADD CONSTRAINT "VaultCaseNote_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "VaultCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- VaultCaseTimeline
CREATE TABLE "VaultCaseTimeline" (
  "id"        TEXT NOT NULL,
  "caseId"    TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload"   JSONB,
  "actor"     TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VaultCaseTimeline_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VaultCaseTimeline_caseId_idx" ON "VaultCaseTimeline"("caseId");
ALTER TABLE "VaultCaseTimeline"
  ADD CONSTRAINT "VaultCaseTimeline_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "VaultCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- VaultAuditLog
CREATE TABLE "VaultAuditLog" (
  "id"                   TEXT NOT NULL,
  "investigatorAccessId" TEXT,
  "profileId"            TEXT,
  "workspaceId"          TEXT,
  "caseId"               TEXT,
  "action"               TEXT NOT NULL,
  "actor"                TEXT NOT NULL,
  "ipAddress"            TEXT,
  "userAgent"            TEXT,
  "metadata"             JSONB,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VaultAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VaultAuditLog_investigatorAccessId_idx" ON "VaultAuditLog"("investigatorAccessId");
CREATE INDEX "VaultAuditLog_profileId_idx"            ON "VaultAuditLog"("profileId");
CREATE INDEX "VaultAuditLog_workspaceId_idx"          ON "VaultAuditLog"("workspaceId");
CREATE INDEX "VaultAuditLog_caseId_idx"               ON "VaultAuditLog"("caseId");
CREATE INDEX "VaultAuditLog_action_idx"               ON "VaultAuditLog"("action");
ALTER TABLE "VaultAuditLog"
  ADD CONSTRAINT "VaultAuditLog_investigatorAccessId_fkey"
  FOREIGN KEY ("investigatorAccessId") REFERENCES "InvestigatorAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VaultAuditLog"
  ADD CONSTRAINT "VaultAuditLog_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "VaultProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VaultAuditLog"
  ADD CONSTRAINT "VaultAuditLog_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "VaultWorkspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
