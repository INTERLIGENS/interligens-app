-- ═══════════════════════════════════════════════════════════════════════════
-- INTERLIGENS — Beta Founder Access 1 € — Migration v1
-- Date: 2026-05-11
-- Branch: feat/billing-beta
-- Target: Neon production (ep-square-band, Frankfurt, port 6543 pooled)
-- Run: PASTE in Neon SQL Editor. DO NOT use `prisma db push`.
-- All operations are ADDITIVE (no DROP, no ALTER on existing tables).
-- Safe to re-run partially: each CREATE uses IF NOT EXISTS where supported,
-- or wrap manually in a transaction and rollback on conflict.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- BillingCustomer — Stripe Customer ↔ INTERLIGENS identity mapping
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BillingCustomer" (
  "id"               TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "stripeCustomerId" TEXT NOT NULL,
  "email"            TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingCustomer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BillingCustomer_userId_key"           ON "BillingCustomer"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "BillingCustomer_stripeCustomerId_key" ON "BillingCustomer"("stripeCustomerId");
CREATE        INDEX IF NOT EXISTS "BillingCustomer_email_idx"            ON "BillingCustomer"("email");

-- ──────────────────────────────────────────────────────────────────────────
-- BetaFounderAccess — reservation + payment record
-- userId is NULLABLE: pre-payment we only have the email; post-payment
-- the webhook back-fills userId with the freshly minted InvestigatorAccess.id.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BetaFounderAccess" (
  "id"                       TEXT NOT NULL,
  "userId"                   TEXT,
  "email"                    TEXT NOT NULL,
  "stripeCustomerId"         TEXT,
  "stripeCheckoutSession"    TEXT,
  "stripeCheckoutSessionUrl" TEXT,
  "stripePaymentIntent"      TEXT,
  "amountCents"              INTEGER NOT NULL DEFAULT 100,
  "currency"                 TEXT NOT NULL DEFAULT 'eur',
  "status"                   TEXT NOT NULL,
  "campaign"                 TEXT NOT NULL DEFAULT 'beta_founder_1eur',
  "reservationExpiresAt"     TIMESTAMP(3),
  "grantedAt"                TIMESTAMP(3),
  "revokedAt"                TIMESTAMP(3),
  "revokeReason"             TEXT,
  "taxAmountCents"           INTEGER,
  "customerCountry"          TEXT,
  "stripeTaxCalculationId"   TEXT,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BetaFounderAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BetaFounderAccess_userId_key"                ON "BetaFounderAccess"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "BetaFounderAccess_stripeCheckoutSession_key" ON "BetaFounderAccess"("stripeCheckoutSession");
CREATE UNIQUE INDEX IF NOT EXISTS "BetaFounderAccess_stripePaymentIntent_key"   ON "BetaFounderAccess"("stripePaymentIntent");
CREATE        INDEX IF NOT EXISTS "BetaFounderAccess_status_idx"                ON "BetaFounderAccess"("status");
CREATE        INDEX IF NOT EXISTS "BetaFounderAccess_campaign_idx"              ON "BetaFounderAccess"("campaign");
CREATE        INDEX IF NOT EXISTS "BetaFounderAccess_email_status_idx"          ON "BetaFounderAccess"("email", "status");
CREATE        INDEX IF NOT EXISTS "BetaFounderAccess_reservationExpiresAt_idx"  ON "BetaFounderAccess"("reservationExpiresAt");

-- ──────────────────────────────────────────────────────────────────────────
-- Entitlement — generic, future-proof access record
-- Today: fed by webhook (source='stripe_checkout') and grandfather script
-- (source='grandfathered'). Phase 2: proxy.ts will start reading this.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Entitlement" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "type"         TEXT NOT NULL,
  "source"       TEXT NOT NULL,
  "sourceId"     TEXT,
  "status"       TEXT NOT NULL,
  "startsAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt"       TIMESTAMP(3),
  "revokedAt"    TIMESTAMP(3),
  "revokeReason" TEXT,
  "metadata"     JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Entitlement_userId_type_status_idx" ON "Entitlement"("userId", "type", "status");
CREATE INDEX IF NOT EXISTS "Entitlement_source_sourceId_idx"    ON "Entitlement"("source",  "sourceId");

-- ──────────────────────────────────────────────────────────────────────────
-- BillingEvent — Stripe webhook idempotency log
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BillingEvent" (
  "id"            TEXT NOT NULL,
  "stripeEventId" TEXT NOT NULL,
  "eventType"     TEXT NOT NULL,
  "payloadHash"   TEXT,
  "processedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BillingEvent_stripeEventId_key" ON "BillingEvent"("stripeEventId");
CREATE        INDEX IF NOT EXISTS "BillingEvent_eventType_idx"     ON "BillingEvent"("eventType");

-- ──────────────────────────────────────────────────────────────────────────
-- WaitlistEntry — captured emails when sold_out
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WaitlistEntry" (
  "id"        TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "source"    TEXT NOT NULL DEFAULT 'beta_founder_soldout',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WaitlistEntry_email_key" ON "WaitlistEntry"("email");

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (DO NOT RUN unless full revert is intended)
-- ═══════════════════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS "BetaFounderAccess", "BillingCustomer", "BillingEvent",
--                      "Entitlement", "WaitlistEntry" CASCADE;
