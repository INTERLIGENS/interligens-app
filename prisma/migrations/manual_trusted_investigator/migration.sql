-- Manual migration for Trusted Investigator Program
-- Apply via Neon SQL Editor. DO NOT run prisma db push.

-- ── Enums ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "InvestigatorVerificationStatus" AS ENUM
    ('PENDING','NEEDS_REVIEW','APPROVED','REJECTED','VERIFIED','TRUSTED','SUSPENDED','REVOKED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "InvestigatorAccessLevel" AS ENUM
    ('APPLICANT','BETA','VERIFIED','TRUSTED_CONTRIBUTOR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "InvestigatorAccessState" AS ENUM ('ACTIVE','SUSPENDED','REVOKED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "InvestigatorApplicationStatus" AS ENUM
    ('PENDING','APPROVED','REJECTED','NEEDS_REVIEW');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "InvestigatorAuditEvent" AS ENUM (
    'INVESTIGATOR_APPLICATION_SUBMITTED',
    'INVESTIGATOR_APPLICATION_APPROVED',
    'INVESTIGATOR_APPLICATION_REJECTED',
    'INVESTIGATOR_APPLICATION_NEEDS_REVIEW',
    'NDA_SIGNED',
    'BETA_TERMS_ACCEPTED',
    'INVESTIGATOR_IDENTITY_COMPLETED',
    'WORKSPACE_ACTIVATED',
    'ACCESS_SUSPENDED',
    'ACCESS_REVOKED',
    'ACCESS_RESTORED',
    'TRUSTED_CONTRIBUTOR_GRANTED',
    'TRUSTED_CONTRIBUTOR_REVOKED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "InvestigatorActivityEvent" AS ENUM (
    'LOGIN','WORKSPACE_OPENED','CASE_CREATED','CASE_OPENED','CASE_UPDATED',
    'ENTITY_ADDED','ENTITY_COUNT_SNAPSHOT','EXPORT_TRIGGERED','SHARE_ACTIVATED',
    'SHARE_DEACTIVATED','PUBLISH_SUBMITTED','ASSISTANT_QUERIED',
    'IDENTITY_UPDATED','SETTINGS_UPDATED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── InvestigatorProfile ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "InvestigatorProfile" (
  "id" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "accessId" TEXT,
  "legalFirstName" TEXT,
  "legalLastName" TEXT,
  "primaryEmail" TEXT,
  "country" TEXT,
  "organizationName" TEXT,
  "verificationStatus" "InvestigatorVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "accessLevel" "InvestigatorAccessLevel" NOT NULL DEFAULT 'APPLICANT',
  "accessState" "InvestigatorAccessState" NOT NULL DEFAULT 'ACTIVE',
  "isEligibleForPublishing" BOOLEAN NOT NULL DEFAULT false,
  "isEligibleForSharing" BOOLEAN NOT NULL DEFAULT false,
  "substantiveContribution" BOOLEAN NOT NULL DEFAULT false,
  "internalReviewNote" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "suspendedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "suspensionReason" TEXT,
  "revokedReason" TEXT,
  "workspaceActivatedAt" TIMESTAMP(3),
  "lastActiveAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvestigatorProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvestigatorProfile_handle_key" ON "InvestigatorProfile"("handle");
CREATE UNIQUE INDEX IF NOT EXISTS "InvestigatorProfile_accessId_key" ON "InvestigatorProfile"("accessId");
CREATE INDEX IF NOT EXISTS "InvestigatorProfile_accessState_idx" ON "InvestigatorProfile"("accessState");
CREATE INDEX IF NOT EXISTS "InvestigatorProfile_accessLevel_idx" ON "InvestigatorProfile"("accessLevel");
CREATE INDEX IF NOT EXISTS "InvestigatorProfile_verificationStatus_idx" ON "InvestigatorProfile"("verificationStatus");

-- ── InvestigatorApplication ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "InvestigatorApplication" (
  "id" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "displayName" TEXT,
  "email" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "languages" TEXT[],
  "specialties" TEXT[],
  "publicLinks" JSONB NOT NULL,
  "background" TEXT NOT NULL,
  "motivation" TEXT NOT NULL,
  "status" "InvestigatorApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "internalNote" TEXT,
  CONSTRAINT "InvestigatorApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InvestigatorApplication_status_idx" ON "InvestigatorApplication"("status");
CREATE INDEX IF NOT EXISTS "InvestigatorApplication_email_idx" ON "InvestigatorApplication"("email");

-- ── InvestigatorNdaAcceptance ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "InvestigatorNdaAcceptance" (
  "id" TEXT NOT NULL,
  "profileId" TEXT,
  "betaCodeId" TEXT,
  "signerName" TEXT NOT NULL,
  "ndaVersion" TEXT NOT NULL,
  "ndaLanguage" TEXT NOT NULL,
  "ndaDocHash" TEXT NOT NULL,
  "accepted" BOOLEAN NOT NULL DEFAULT true,
  "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  CONSTRAINT "InvestigatorNdaAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvestigatorNdaAcceptance_profileId_key" ON "InvestigatorNdaAcceptance"("profileId");
CREATE INDEX IF NOT EXISTS "InvestigatorNdaAcceptance_betaCodeId_idx" ON "InvestigatorNdaAcceptance"("betaCodeId");

DO $$ BEGIN
  ALTER TABLE "InvestigatorNdaAcceptance"
    ADD CONSTRAINT "InvestigatorNdaAcceptance_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "InvestigatorProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── InvestigatorBetaTermsAcceptance ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "InvestigatorBetaTermsAcceptance" (
  "id" TEXT NOT NULL,
  "profileId" TEXT,
  "betaCodeId" TEXT,
  "signerName" TEXT NOT NULL,
  "termsVersion" TEXT NOT NULL,
  "termsLanguage" TEXT NOT NULL,
  "termsDocHash" TEXT NOT NULL,
  "accepted" BOOLEAN NOT NULL DEFAULT true,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  CONSTRAINT "InvestigatorBetaTermsAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvestigatorBetaTermsAcceptance_profileId_key" ON "InvestigatorBetaTermsAcceptance"("profileId");
CREATE INDEX IF NOT EXISTS "InvestigatorBetaTermsAcceptance_betaCodeId_idx" ON "InvestigatorBetaTermsAcceptance"("betaCodeId");

DO $$ BEGIN
  ALTER TABLE "InvestigatorBetaTermsAcceptance"
    ADD CONSTRAINT "InvestigatorBetaTermsAcceptance_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "InvestigatorProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── InvestigatorProgramAuditLog ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "InvestigatorProgramAuditLog" (
  "id" TEXT NOT NULL,
  "profileId" TEXT,
  "event" "InvestigatorAuditEvent" NOT NULL,
  "actorId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvestigatorProgramAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InvestigatorProgramAuditLog_profileId_idx" ON "InvestigatorProgramAuditLog"("profileId");
CREATE INDEX IF NOT EXISTS "InvestigatorProgramAuditLog_event_idx" ON "InvestigatorProgramAuditLog"("event");
CREATE INDEX IF NOT EXISTS "InvestigatorProgramAuditLog_createdAt_idx" ON "InvestigatorProgramAuditLog"("createdAt");

DO $$ BEGIN
  ALTER TABLE "InvestigatorProgramAuditLog"
    ADD CONSTRAINT "InvestigatorProgramAuditLog_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "InvestigatorProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── InvestigatorActivityLog ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "InvestigatorActivityLog" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "event" "InvestigatorActivityEvent" NOT NULL,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvestigatorActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InvestigatorActivityLog_profileId_idx" ON "InvestigatorActivityLog"("profileId");
CREATE INDEX IF NOT EXISTS "InvestigatorActivityLog_event_idx" ON "InvestigatorActivityLog"("event");
CREATE INDEX IF NOT EXISTS "InvestigatorActivityLog_createdAt_idx" ON "InvestigatorActivityLog"("createdAt");

DO $$ BEGIN
  ALTER TABLE "InvestigatorActivityLog"
    ADD CONSTRAINT "InvestigatorActivityLog_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "InvestigatorProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
