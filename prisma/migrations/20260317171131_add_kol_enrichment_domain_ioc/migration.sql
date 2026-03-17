-- AlterTable
ALTER TABLE "KolProfile" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "followerCount" INTEGER,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "pricePerPost" DOUBLE PRECISION,
ADD COLUMN     "tags" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "tier" TEXT;

-- CreateTable
CREATE TABLE "DomainIoc" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "domain" TEXT NOT NULL,
    "labelType" TEXT NOT NULL DEFAULT 'phishing',
    "confidence" TEXT NOT NULL DEFAULT 'low',
    "status" TEXT NOT NULL DEFAULT 'active',
    "sourceIntakeId" TEXT,
    "notes" TEXT,

    CONSTRAINT "DomainIoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DomainIoc_domain_key" ON "DomainIoc"("domain");
