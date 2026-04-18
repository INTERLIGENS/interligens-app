-- Migration: Founding Intelligence Seed (day-1 threat labels)
-- Additive only. Run via Neon SQL Editor (ep-square-band).
-- Safe to re-run; every statement is idempotent.

BEGIN;

-- ── DomainLabel ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "DomainLabel" (
    "id"          TEXT PRIMARY KEY,
    "domain"      TEXT NOT NULL,
    "labelType"   TEXT NOT NULL,
    "label"       TEXT NOT NULL,
    "confidence"  TEXT NOT NULL DEFAULT 'medium',
    "category"    TEXT,
    "entityName"  TEXT,
    "sourceName"  TEXT NOT NULL,
    "sourceUrl"   TEXT,
    "evidence"    TEXT,
    "visibility"  TEXT NOT NULL DEFAULT 'internal_only',
    "license"     TEXT,
    "tosRisk"     TEXT NOT NULL DEFAULT 'low',
    "isActive"    BOOLEAN NOT NULL DEFAULT TRUE,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "DomainLabel_dedup_key"
    ON "DomainLabel"("domain", "labelType", "label", "sourceUrl");
CREATE INDEX IF NOT EXISTS "DomainLabel_domain_idx"
    ON "DomainLabel"("domain");
CREATE INDEX IF NOT EXISTS "DomainLabel_sourceName_idx"
    ON "DomainLabel"("sourceName");

-- ── ProtocolLabel ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ProtocolLabel" (
    "id"          TEXT PRIMARY KEY,
    "slug"        TEXT NOT NULL UNIQUE,
    "name"        TEXT NOT NULL,
    "category"    TEXT,
    "chains"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "website"     TEXT,
    "twitter"     TEXT,
    "logo"        TEXT,
    "description" TEXT,
    "tvlUsd"      DOUBLE PRECISION,
    "sourceName"  TEXT NOT NULL DEFAULT 'DefiLlama',
    "sourceUrl"   TEXT,
    "fetchedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ProtocolLabel_category_idx"
    ON "ProtocolLabel"("category");

-- ── ExternalLookupCache ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ExternalLookupCache" (
    "id"         TEXT PRIMARY KEY,
    "source"     TEXT NOT NULL,
    "queryType"  TEXT NOT NULL,
    "queryKey"   TEXT NOT NULL,
    "status"     TEXT NOT NULL,
    "payload"    JSONB,
    "errorCode"  TEXT,
    "fetchedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExternalLookupCache_source_queryType_queryKey_key"
    ON "ExternalLookupCache"("source", "queryType", "queryKey");
CREATE INDEX IF NOT EXISTS "ExternalLookupCache_source_expiresAt_idx"
    ON "ExternalLookupCache"("source", "expiresAt");
CREATE INDEX IF NOT EXISTS "ExternalLookupCache_queryKey_idx"
    ON "ExternalLookupCache"("queryKey");

COMMIT;
