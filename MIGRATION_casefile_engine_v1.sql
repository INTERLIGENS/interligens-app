-- CreateTable
CREATE TABLE "CasefileDraft" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "casefileId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "dataClassification" TEXT NOT NULL DEFAULT 'synthetic-demo',
    "intendedAudience" TEXT NOT NULL DEFAULT 'format-test',
    "legalDisclaimerAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "syntheticAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "reportingCountry" TEXT NOT NULL,
    "reportingLanguage" TEXT,
    "controlledWallets" JSONB NOT NULL,
    "walletControlProof" JSONB NOT NULL,
    "fundsSource" TEXT NOT NULL,
    "amountEur" DOUBLE PRECISION,
    "amountUnknown" BOOLEAN NOT NULL DEFAULT false,
    "pricingMethodNote" TEXT,
    "incidentPattern" TEXT NOT NULL,
    "timeline" JSONB NOT NULL,
    "txids" TEXT[],
    "noTxidJustification" TEXT,
    "addressesInFlow" JSONB NOT NULL,
    "obfuscationBreakpointCandidate" BOOLEAN NOT NULL DEFAULT false,
    "cexTouchpointDetected" JSONB NOT NULL,
    "domains" JSONB NOT NULL,
    "platformName" TEXT,
    "publicHandlesMentioned" JSONB NOT NULL,
    "primaryTriage" TEXT,
    "potentialCivilReviewFlag" BOOLEAN NOT NULL DEFAULT false,
    "clusterFlag" BOOLEAN NOT NULL DEFAULT false,
    "jurisdictionalFlags" JSONB NOT NULL,
    "evidencePackageCompleteness" JSONB NOT NULL,
    "counselReviewRequired" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CasefileDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exhibit" (
    "id" TEXT NOT NULL,
    "casefileDraftId" TEXT NOT NULL,
    "exhibitId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "dateCollected" TIMESTAMP(3) NOT NULL,
    "collectionMethod" TEXT NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "storageUri" TEXT NOT NULL,
    "relevance" TEXT NOT NULL,
    "attributionLevel" TEXT NOT NULL,
    "sourceReliability" TEXT NOT NULL,
    "redactionStatus" TEXT NOT NULL,
    "admissibilityRisk" TEXT NOT NULL,
    "chainOfCustodyNotes" TEXT,

    CONSTRAINT "Exhibit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CasefileDraft_casefileId_key" ON "CasefileDraft"("casefileId");

-- CreateIndex
CREATE UNIQUE INDEX "Exhibit_casefileDraftId_exhibitId_key" ON "Exhibit"("casefileDraftId", "exhibitId");

-- AddForeignKey
ALTER TABLE "Exhibit" ADD CONSTRAINT "Exhibit_casefileDraftId_fkey" FOREIGN KEY ("casefileDraftId") REFERENCES "CasefileDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

