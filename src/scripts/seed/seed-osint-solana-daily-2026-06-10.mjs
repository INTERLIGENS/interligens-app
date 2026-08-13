// Commit-time seeder for OSINT session session_2026-06-10_solana_daily
// PREREQUISITE: run exports/migrations_evidence_2026-06-10.sql in Neon SQL Editor FIRST
// (adds forensic columns to EvidenceSnapshot + creates EvidenceNegative).
//
// Usage (only after David says "go commit"):
//   set -a; . ./.env.local; set +a; node src/scripts/seed/seed-osint-solana-daily-2026-06-10.mjs
//
// Idempotent: EvidenceSnapshot guarded by UNIQUE(sha256), EvidenceNegative by
// UNIQUE(kolHandle,tokenSymbol,sessionId). Safe to re-run.

import { PrismaClient, Prisma } from '@prisma/client'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const PLAN = 'exports/seed_plan_2026-06-10.json'
const REPORT = 'exports/seed_report_2026-06-10.json'

const prisma = new PrismaClient()
const plan = JSON.parse(readFileSync(PLAN, 'utf8'))
const report = { session: plan.session, startedAt: new Date().toISOString(),
  kolProfile: null, kolTokenLinks: { ok: 0, failed: [] },
  evidences: { inserted: 0, skipped_existing: 0, missing_file: 0, failed: [] },
  negatives: { inserted: 0, skipped_existing: 0, failed: [] } }

async function preflight() {
  // Confirm migration ran: forensic columns + EvidenceNegative table present.
  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'EvidenceSnapshot' AND column_name IN ('sha256','localFilePath','sessionId','kolHandle','tokenSymbol','notes')`)
  if (cols.length < 6) throw new Error(`Migration not applied: EvidenceSnapshot missing forensic columns (found ${cols.length}/6). Run exports/migrations_evidence_2026-06-10.sql first.`)
  const neg = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('public."EvidenceNegative"')::text AS t`)
  if (!neg[0].t) throw new Error('Migration not applied: table EvidenceNegative does not exist. Run the migration SQL first.')
}

async function seedKol() {
  const k = plan.kolProfileToCreate
  const row = await prisma.kolProfile.upsert({
    where: { handle: k.handle },
    update: {}, // do not clobber an existing profile
    create: {
      handle: k.handle, platform: k.platform, displayName: k.displayName,
      evidenceStatus: k.evidenceStatus, internalNote: k.internalNote,
      publishable: k.publishable, publishStatus: k.publishStatus,
    },
  })
  report.kolProfile = { handle: row.handle, id: row.id, created: row.createdAt?.toISOString?.() ?? null }
}

async function seedLinks() {
  for (const l of plan.kolTokenLinksToCreate) {
    try {
      await prisma.kolTokenLink.upsert({
        where: { kolHandle_contractAddress_chain: { kolHandle: l.kolHandle, contractAddress: l.contractAddress, chain: l.chain } },
        update: {},
        create: { kolHandle: l.kolHandle, contractAddress: l.contractAddress, chain: l.chain,
          tokenSymbol: l.tokenSymbol, role: l.role, documentationStatus: l.documentationStatus,
          attributionNote: l.attributionNote, note: l.note },
      })
      report.kolTokenLinks.ok++
    } catch (e) { report.kolTokenLinks.failed.push({ tokenSymbol: l.tokenSymbol, error: e.message }) }
  }
}

async function seedEvidences() {
  for (const e of plan.evidences) {
    const path = e.localFilePath
    if (!existsSync(path)) report.evidences.missing_file++ // renamed file not on disk yet
    try {
      const observedAt = new Date(e.capturedAt)
      const res = await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "EvidenceSnapshot"
          ("id","relationType","relationKey","snapshotType","imageUrl","title","caption",
           "sourceLabel","sourceUrl","observedAt","displayOrder","isPublic","reviewStatus",
           "createdAt","updatedAt","kolHandle","tokenSymbol","localFilePath","sha256","sessionId","notes")
        VALUES
          (gen_random_uuid()::text, ${e.relationType}, ${e.relationKey}, ${e.snapshotType}, NULL,
           ${e.title}, ${e.caption}, ${e.sourceLabel}, ${e.sourceUrl}, ${observedAt}, ${e.displayOrder},
           ${e.isPublic}, ${e.reviewStatus}, now(), now(), ${e.kolHandle}, ${e.tokenSymbol},
           ${e.localFilePath}, ${e.sha256}, ${e.sessionId},
           ${`tokenMatch=${e.tokenMatch}; bytes=${e.bytes}; origName=${e.localFilePathCurrent.split('/').pop()}`})
        ON CONFLICT ("sha256") DO NOTHING`)
      if (res === 0) report.evidences.skipped_existing++; else report.evidences.inserted++
    } catch (err) { report.evidences.failed.push({ sha256: e.sha256, tokenSymbol: e.tokenSymbol, error: err.message }) }
  }
}

async function seedNegatives() {
  for (const n of plan.negatives) {
    try {
      const observedAt = new Date(`2026-06-10T00:00:00+02:00`)
      const res = await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "EvidenceNegative"
          ("kolHandle","tokenSymbol","observedAt","sessionId","sourceUrl","classification","note","reviewStatus")
        VALUES
          (${n.kolHandle}, ${n.tokenSymbol}, ${observedAt}, ${n.sessionId}, ${n.sourceUrl},
           ${'confirmed_negative'}, ${n.note}, ${'approved'})
        ON CONFLICT ("kolHandle","tokenSymbol","sessionId") DO NOTHING`)
      if (res === 0) report.negatives.skipped_existing++; else report.negatives.inserted++
    } catch (err) { report.negatives.failed.push({ tokenSymbol: n.tokenSymbol, error: err.message }) }
  }
}

try {
  await preflight()
  await seedKol()
  await seedLinks()
  await seedEvidences()
  await seedNegatives()
  report.finishedAt = new Date().toISOString()
  report.ok = report.kolTokenLinks.failed.length === 0 && report.evidences.failed.length === 0 && report.negatives.failed.length === 0
  writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ kol: report.kolProfile?.handle, links_ok: report.kolTokenLinks.ok,
    evidences_inserted: report.evidences.inserted, evidences_skipped: report.evidences.skipped_existing,
    evidences_missing_file: report.evidences.missing_file, negatives_inserted: report.negatives.inserted,
    negatives_skipped: report.negatives.skipped_existing, ok: report.ok }, null, 2))
} catch (e) {
  console.error('SEED ABORTED:', e.message)
  process.exitCode = 1
} finally { await prisma.$disconnect() }
