-- RWA Registry v1 — additive migration
-- 10 tables + 9 enums + 11 FK. Idempotent via IF NOT EXISTS / EXCEPTION blocks.
-- Generated from prisma/schema.prod.prisma (models Rwa*).
-- Apply via Neon SQL Editor against ep-square-band.
-- CreateEnum
DO $$ BEGIN CREATE TYPE "RwaIssuerType" AS ENUM ('ASSET_MANAGER', 'PLATFORM', 'SPV', 'REAL_ESTATE_ISSUER', 'BANK', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "RwaIssuerStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'DEPRECATED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "RwaAssetClass" AS ENUM ('STOCKS', 'TREASURIES', 'REAL_ESTATE', 'CREDIT', 'COMMODITY', 'YIELD', 'MONEY_MARKET'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "RwaChainFamily" AS ENUM ('EVM', 'SOLANA', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "RwaContractVerificationStatus" AS ENUM ('VERIFIED_OFFICIAL', 'SUSPECTED_OLD', 'DEPRECATED', 'REVOKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "RwaAliasType" AS ENUM ('PROXY', 'IMPLEMENTATION', 'BRIDGE_REPRESENTATION', 'LEGACY_CONTRACT', 'WRAPPED_FORM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "RwaSourceType" AS ENUM ('OFFICIAL_DOCS', 'ISSUER_SITE', 'REGULATORY_FILING', 'BLOCK_EXPLORER', 'PRESS_RELEASE', 'GITHUB', 'ORACLE', 'INTERNAL_VERIFICATION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "RwaVerificationEventType" AS ENUM ('CREATED', 'VERIFIED', 'MIGRATED', 'DEPRECATED', 'REVALIDATED', 'SOURCE_ADDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN CREATE TYPE "RwaMatchVerdict" AS ENUM ('EXACT_VERIFIED', 'EXACT_ALIAS_VERIFIED', 'LEGACY_VERIFIED', 'PROBABLE_FAMILY_MISMATCH', 'UNKNOWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "RwaIssuer" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "legalEntityName" TEXT,
    "issuerType" "RwaIssuerType" NOT NULL,
    "jurisdictionCode" TEXT,
    "regulatoryStatus" TEXT,
    "websiteUrl" TEXT,
    "status" "RwaIssuerStatus" NOT NULL DEFAULT 'DRAFT',
    "riskNotesInternal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RwaIssuer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RwaIssuerAlias" (
    "id" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RwaIssuerAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RwaAsset" (
    "id" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetClass" "RwaAssetClass" NOT NULL,
    "underlyingReference" TEXT,
    "isinOrEquivalent" TEXT,
    "cusipOrEquivalent" TEXT,
    "officialProductUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RwaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RwaAssetAlias" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RwaAssetAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RwaContract" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "chainFamily" "RwaChainFamily" NOT NULL,
    "chainKey" TEXT NOT NULL,
    "contractAddressRaw" TEXT NOT NULL,
    "contractAddressNorm" TEXT NOT NULL,
    "tokenStandard" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isDeprecated" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "RwaContractVerificationStatus" NOT NULL DEFAULT 'VERIFIED_OFFICIAL',
    "verificationDate" TIMESTAMP(3),
    "supersededByContractId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RwaContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RwaContractAlias" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "aliasType" "RwaAliasType" NOT NULL,
    "addressNorm" TEXT NOT NULL,
    "chainKey" TEXT NOT NULL,
    "verificationStatus" "RwaContractVerificationStatus" NOT NULL DEFAULT 'VERIFIED_OFFICIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RwaContractAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RwaVerificationSource" (
    "id" TEXT NOT NULL,
    "issuerId" TEXT,
    "assetId" TEXT,
    "contractId" TEXT,
    "sourceType" "RwaSourceType" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" TEXT,
    "snapshotR2Key" TEXT,
    "isPrimaryEvidence" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "RwaVerificationSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RwaVerificationEvent" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "eventType" "RwaVerificationEventType" NOT NULL,
    "summary" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RwaVerificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RwaScanCache" (
    "id" TEXT NOT NULL,
    "inputAddressNorm" TEXT NOT NULL,
    "chainKey" TEXT NOT NULL,
    "registryVersion" INTEGER NOT NULL,
    "matchVerdict" "RwaMatchVerdict" NOT NULL,
    "matchedContractId" TEXT,
    "matchedAssetId" TEXT,
    "matchedIssuerId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "explanationJson" JSONB NOT NULL,
    "cachedUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RwaScanCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RwaRegistryMeta" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RwaRegistryMeta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RwaIssuer_slug_key" ON "RwaIssuer"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaIssuer_slug_idx" ON "RwaIssuer"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaIssuer_status_idx" ON "RwaIssuer"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaIssuerAlias_alias_idx" ON "RwaIssuerAlias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RwaIssuerAlias_issuerId_alias_key" ON "RwaIssuerAlias"("issuerId", "alias");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaAsset_symbol_idx" ON "RwaAsset"("symbol");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaAsset_assetClass_idx" ON "RwaAsset"("assetClass");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaAsset_issuerId_idx" ON "RwaAsset"("issuerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RwaAsset_issuerId_symbol_key" ON "RwaAsset"("issuerId", "symbol");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaAssetAlias_alias_idx" ON "RwaAssetAlias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RwaAssetAlias_assetId_alias_key" ON "RwaAssetAlias"("assetId", "alias");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaContract_contractAddressNorm_idx" ON "RwaContract"("contractAddressNorm");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaContract_chainKey_idx" ON "RwaContract"("chainKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaContract_verificationStatus_idx" ON "RwaContract"("verificationStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaContract_assetId_idx" ON "RwaContract"("assetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaContract_supersededByContractId_idx" ON "RwaContract"("supersededByContractId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RwaContract_chainKey_contractAddressNorm_key" ON "RwaContract"("chainKey", "contractAddressNorm");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaContractAlias_addressNorm_idx" ON "RwaContractAlias"("addressNorm");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaContractAlias_chainKey_idx" ON "RwaContractAlias"("chainKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RwaContractAlias_chainKey_addressNorm_key" ON "RwaContractAlias"("chainKey", "addressNorm");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaVerificationSource_issuerId_idx" ON "RwaVerificationSource"("issuerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaVerificationSource_assetId_idx" ON "RwaVerificationSource"("assetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaVerificationSource_contractId_idx" ON "RwaVerificationSource"("contractId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaVerificationEvent_contractId_idx" ON "RwaVerificationEvent"("contractId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaVerificationEvent_createdAt_idx" ON "RwaVerificationEvent"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaScanCache_cachedUntil_idx" ON "RwaScanCache"("cachedUntil");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RwaScanCache_registryVersion_idx" ON "RwaScanCache"("registryVersion");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RwaScanCache_inputAddressNorm_chainKey_key" ON "RwaScanCache"("inputAddressNorm", "chainKey");

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "RwaIssuerAlias" ADD CONSTRAINT "RwaIssuerAlias_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "RwaIssuer"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "RwaAsset" ADD CONSTRAINT "RwaAsset_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "RwaIssuer"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "RwaAssetAlias" ADD CONSTRAINT "RwaAssetAlias_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "RwaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "RwaContract" ADD CONSTRAINT "RwaContract_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "RwaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "RwaContract" ADD CONSTRAINT "RwaContract_supersededByContractId_fkey" FOREIGN KEY ("supersededByContractId") REFERENCES "RwaContract"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "RwaContractAlias" ADD CONSTRAINT "RwaContractAlias_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "RwaContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "RwaVerificationSource" ADD CONSTRAINT "RwaVerificationSource_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "RwaIssuer"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "RwaVerificationSource" ADD CONSTRAINT "RwaVerificationSource_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "RwaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "RwaVerificationSource" ADD CONSTRAINT "RwaVerificationSource_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "RwaContract"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "RwaVerificationEvent" ADD CONSTRAINT "RwaVerificationEvent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "RwaContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "RwaScanCache" ADD CONSTRAINT "RwaScanCache_matchedContractId_fkey" FOREIGN KEY ("matchedContractId") REFERENCES "RwaContract"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

