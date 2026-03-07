-- CreateTable
CREATE TABLE "SourceRegistry" (
    "id" TEXT NOT NULL,
    "handle" TEXT,
    "sourceName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'other',
    "url" TEXT,
    "homepageUrl" TEXT,
    "description" TEXT,
    "defaultChain" TEXT,
    "defaultLabelType" TEXT,
    "defaultLabel" TEXT,
    "defaultVisibility" TEXT NOT NULL DEFAULT 'internal_only',
    "license" TEXT,
    "tosRisk" TEXT NOT NULL DEFAULT 'low',
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionBatch" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "inputType" TEXT NOT NULL,
    "inputPayload" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "matchedAddrs" INTEGER NOT NULL DEFAULT 0,
    "dedupedRows" INTEGER NOT NULL DEFAULT 0,
    "warnings" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "processingStartedAt" TIMESTAMP(3),
    "processingEndedAt" TIMESTAMP(3),
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawDocument" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'text/plain',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddressLabel" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "labelType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'low',
    "entityName" TEXT,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "evidence" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'internal_only',
    "license" TEXT,
    "tosRisk" TEXT NOT NULL DEFAULT 'low',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT,

    CONSTRAINT "AddressLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskSummaryCache" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskSummaryCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "batchId" TEXT,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceTemplate" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "inputType" TEXT NOT NULL,
    "columnMapping" TEXT NOT NULL,
    "rules" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceRegistry_handle_key" ON "SourceRegistry"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "SourceRegistry_name_key" ON "SourceRegistry"("name");

-- CreateIndex
CREATE INDEX "AddressLabel_chain_address_idx" ON "AddressLabel"("chain", "address");

-- CreateIndex
CREATE INDEX "AddressLabel_batchId_idx" ON "AddressLabel"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "AddressLabel_chain_address_labelType_label_sourceUrl_key" ON "AddressLabel"("chain", "address", "labelType", "label", "sourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "RiskSummaryCache_chain_address_key" ON "RiskSummaryCache"("chain", "address");

-- AddForeignKey
ALTER TABLE "IngestionBatch" ADD CONSTRAINT "IngestionBatch_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceRegistry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawDocument" ADD CONSTRAINT "RawDocument_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IngestionBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressLabel" ADD CONSTRAINT "AddressLabel_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IngestionBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IngestionBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceTemplate" ADD CONSTRAINT "SourceTemplate_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceRegistry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

