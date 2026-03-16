-- CreateTable
CREATE TABLE "IntakeRecord" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "inputType" TEXT NOT NULL,
    "sourceRef" TEXT,
    "sourceId" TEXT,
    "submittedBy" TEXT,
    "provenance" TEXT NOT NULL DEFAULT '{}',
    "parserUsed" TEXT NOT NULL DEFAULT 'unknown',
    "extractVersion" TEXT NOT NULL DEFAULT 'v1',
    "rawText" TEXT,
    "rawTextTruncated" BOOLEAN NOT NULL DEFAULT false,
    "extracted" TEXT NOT NULL DEFAULT '{}',
    "classification" TEXT NOT NULL DEFAULT 'rawdoc',
    "routerConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "extractWarnings" TEXT NOT NULL DEFAULT '[]',
    "pendingBatch" BOOLEAN NOT NULL DEFAULT false,
    "linkedBatchId" TEXT,
    "linkedBatchId2" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "adminNotes" TEXT,

    CONSTRAINT "IntakeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KolProfile" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "handle" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'x',
    "label" TEXT NOT NULL DEFAULT 'unknown',
    "riskFlag" TEXT NOT NULL DEFAULT 'unverified',
    "wallets" TEXT NOT NULL DEFAULT '[]',
    "sourceIntakeIds" TEXT NOT NULL DEFAULT '[]',
    "confidence" TEXT NOT NULL DEFAULT 'low',
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "KolProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KolProfile_handle_key" ON "KolProfile"("handle");

-- AddForeignKey
ALTER TABLE "IntakeRecord" ADD CONSTRAINT "IntakeRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceRegistry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeRecord" ADD CONSTRAINT "IntakeRecord_linkedBatchId_fkey" FOREIGN KEY ("linkedBatchId") REFERENCES "IngestionBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeRecord" ADD CONSTRAINT "IntakeRecord_linkedBatchId2_fkey" FOREIGN KEY ("linkedBatchId2") REFERENCES "IngestionBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
