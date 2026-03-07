-- CreateTable
CREATE TABLE "SourceTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "inputType" TEXT NOT NULL,
    "columnMapping" TEXT NOT NULL,
    "rules" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SourceTemplate_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceRegistry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AddressLabel" (
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
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT,
    CONSTRAINT "AddressLabel_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IngestionBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AddressLabel" ("address", "batchId", "chain", "confidence", "entityName", "evidence", "firstSeenAt", "id", "label", "labelType", "lastSeenAt", "license", "sourceName", "sourceUrl", "tosRisk", "visibility") SELECT "address", "batchId", "chain", "confidence", "entityName", "evidence", "firstSeenAt", "id", "label", "labelType", "lastSeenAt", "license", "sourceName", "sourceUrl", "tosRisk", "visibility" FROM "AddressLabel";
DROP TABLE "AddressLabel";
ALTER TABLE "new_AddressLabel" RENAME TO "AddressLabel";
CREATE INDEX "AddressLabel_chain_address_idx" ON "AddressLabel"("chain", "address");
CREATE INDEX "AddressLabel_batchId_idx" ON "AddressLabel"("batchId");
CREATE UNIQUE INDEX "AddressLabel_chain_address_labelType_label_sourceUrl_key" ON "AddressLabel"("chain", "address", "labelType", "label", "sourceUrl");
CREATE TABLE "new_IngestionBatch" (
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
    "processingStartedAt" DATETIME,
    "processingEndedAt" DATETIME,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "rolledBackAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IngestionBatch_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceRegistry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_IngestionBatch" ("approvedAt", "approvedBy", "createdAt", "dedupedRows", "id", "inputPayload", "inputType", "matchedAddrs", "sourceId", "status", "totalRows", "updatedAt", "warnings") SELECT "approvedAt", "approvedBy", "createdAt", "dedupedRows", "id", "inputPayload", "inputType", "matchedAddrs", "sourceId", "status", "totalRows", "updatedAt", "warnings" FROM "IngestionBatch";
DROP TABLE "IngestionBatch";
ALTER TABLE "new_IngestionBatch" RENAME TO "IngestionBatch";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
