CREATE TABLE IF NOT EXISTS "WalletLabel" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WalletLabel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WalletLabel_address_idx" ON "WalletLabel"("address");
CREATE INDEX IF NOT EXISTS "WalletLabel_chain_idx" ON "WalletLabel"("chain");
CREATE INDEX IF NOT EXISTS "WalletLabel_category_idx" ON "WalletLabel"("category");
CREATE INDEX IF NOT EXISTS "WalletLabel_verified_idx" ON "WalletLabel"("verified");
