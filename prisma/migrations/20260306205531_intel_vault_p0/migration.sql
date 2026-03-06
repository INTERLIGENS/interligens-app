-- CreateTable
CREATE TABLE "SourceRegistry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "license" TEXT,
    "tosRisk" TEXT NOT NULL DEFAULT 'low',
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IngestionBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "inputType" TEXT NOT NULL,
    "inputPayload" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "matchedAddrs" INTEGER NOT NULL DEFAULT 0,
    "dedupedRows" INTEGER NOT NULL DEFAULT 0,
    "warnings" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IngestionBatch_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceRegistry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RawDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'text/plain',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RawDocument_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IngestionBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AddressLabel" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT,
    CONSTRAINT "AddressLabel_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IngestionBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskSummaryCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chain" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "batchId" TEXT,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IngestionBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
