-- PDF Engine V2 — additive columns on KolProfile
-- Apply via Neon SQL Editor (ep-square-band). Additive only. Safe to re-run.

ALTER TABLE "KolProfile" ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT;
ALTER TABLE "KolProfile" ADD COLUMN IF NOT EXISTS "pdfGeneratedAt" TIMESTAMPTZ;
ALTER TABLE "KolProfile" ADD COLUMN IF NOT EXISTS "pdfScore" INTEGER;
ALTER TABLE "KolProfile" ADD COLUMN IF NOT EXISTS "pdfVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "KolProfile" ADD COLUMN IF NOT EXISTS "lastHeliusScan" TIMESTAMPTZ;
