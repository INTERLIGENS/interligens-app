-- Manual migration for feat/watch-post-scan
-- Apply via Neon SQL Editor. DO NOT run prisma db push.

CREATE TABLE IF NOT EXISTS "WatchedAddress" (
  "id" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "chain" TEXT NOT NULL,
  "label" TEXT,
  "ownerAccessId" TEXT NOT NULL,
  "lastScore" INTEGER,
  "lastTier" TEXT,
  "lastGovernedStatus" TEXT,
  "lastScannedAt" TIMESTAMP(3),
  "alertOnChange" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WatchedAddress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WatchedAddress_address_chain_ownerAccessId_key"
  ON "WatchedAddress"("address", "chain", "ownerAccessId");
CREATE INDEX IF NOT EXISTS "WatchedAddress_ownerAccessId_idx"
  ON "WatchedAddress"("ownerAccessId");
CREATE INDEX IF NOT EXISTS "WatchedAddress_active_lastScannedAt_idx"
  ON "WatchedAddress"("active", "lastScannedAt");

CREATE TABLE IF NOT EXISTS "WatchAlert" (
  "id" TEXT NOT NULL,
  "watchedAddressId" TEXT NOT NULL,
  "previousScore" INTEGER,
  "newScore" INTEGER NOT NULL,
  "previousTier" TEXT,
  "newTier" TEXT NOT NULL,
  "changeType" TEXT NOT NULL,
  "changeDetail" TEXT,
  "notifiedAt" TIMESTAMP(3),
  "emailSent" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WatchAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WatchAlert_watchedAddressId_idx"
  ON "WatchAlert"("watchedAddressId");

DO $$ BEGIN
  ALTER TABLE "WatchAlert"
    ADD CONSTRAINT "WatchAlert_watchedAddressId_fkey"
    FOREIGN KEY ("watchedAddressId") REFERENCES "WatchedAddress"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
