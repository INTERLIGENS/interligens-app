-- CreateTable
CREATE TABLE "CommunitySubmission" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "chain" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "labelType" TEXT NOT NULL,
    "label" TEXT,
    "message" TEXT,
    "evidenceUrl" TEXT,
    "txHash" TEXT,
    "reporterContact" TEXT,
    "ipHash" TEXT NOT NULL,
    "userAgentHash" TEXT,
    "source" TEXT NOT NULL DEFAULT 'community',
    "severityDerived" TEXT NOT NULL DEFAULT 'info',
    "adminNotes" TEXT,
    "linkedBatchId" TEXT,
    CONSTRAINT "CommunitySubmission_pkey" PRIMARY KEY ("id")
);
