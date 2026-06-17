// Commit-time seeder for OSINT session 2026-06-17_empire_sol1 (KOL Empire_sol1).
// Idempotent: EvidenceSnapshot guarded by UNIQUE(sha256) via ON CONFLICT DO NOTHING;
// KolTokenLink by UNIQUE(kolHandle,contractAddress,chain) via upsert. Safe to re-run.
// NO migration (forensic columns already in prod via known drift).
// Usage: set -a; . ./.env.local; set +a; node src/scripts/seed/seed-osint-empire-2026-06-17.mjs
import { PrismaClient, Prisma } from '@prisma/client'
import { readFileSync, existsSync } from 'node:fs'

const PLAN = 'exports/seed_plan_2026-06-17_empire_sol1.json'
const REPORT = 'exports/seed_report_2026-06-17_empire_sol1.json'
const plan = JSON.parse(readFileSync(PLAN, 'utf8'))
const prisma = new PrismaClient()
const report = { session: plan.session, startedAt: new Date().toISOString(),
  kolProfile: null, kolTokenLinks: { ok: 0, failed: [] },
  evidences: { inserted: 0, skipped_existing: 0, missing_file: 0, failed: [] } }

function dbHostGuard() {
  const u = process.env.DATABASE_URL || ''
  if (!u) throw new Error('DATABASE_URL not set (run: set -a; . ./.env.local; set +a)')
  if (!u.includes('ep-square-band')) throw new Error('DATABASE_URL is NOT ep-square-band — refusing to write. Abort.')
  if (u.includes('ep-bold-sky')) throw new Error('DATABASE_URL points at ep-bold-sky — forbidden. Abort.')
}

async function preflight() {
  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'EvidenceSnapshot'
       AND column_name IN ('sha256','localFilePath','sessionId','kolHandle','tokenSymbol','notes')`)
  if (cols.length < 6) throw new Error(`EvidenceSnapshot missing forensic columns (found ${cols.length}/6) — do NOT migrate here, escalate.`)
  const uniq = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM pg_indexes WHERE tablename='EvidenceSnapshot' AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%sha256%' LIMIT 1`)
  if (!uniq.length) throw new Error('No UNIQUE index on EvidenceSnapshot.sha256 — ON CONFLICT idempotence unsafe. Abort.')
}

async function seedKol() {
  const k = plan.kolProfileToCreate
  const row = await prisma.kolProfile.upsert({
    where: { handle: k.handle },
    update: {}, // no-clobber
    create: { handle: k.handle, platform: k.platform, displayName: k.displayName,
      evidenceStatus: k.evidenceStatus, internalNote: k.internalNote,
      publishable: k.publishable, publishStatus: k.publishStatus },
  })
  report.kolProfile = { handle: row.handle, id: row.id }
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
    } catch (e) { report.kolTokenLinks.failed.push({ tokenSymbol: l.tokenSymbol, ca: l.contractAddress, error: e.message }) }
  }
}

async function seedEvidences() {
  for (const e of plan.evidences) {
    if (!existsSync(e.localFilePath)) report.evidences.missing_file++
    const notes = `${e.notes} | origName=${e.localFilePathCurrent.split('/').pop()} bytes=${e.bytes}`
    try {
      const observedAt = new Date(e.capturedAt)
      const n = await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "EvidenceSnapshot"
          ("id","relationType","relationKey","snapshotType","imageUrl","title","caption",
           "sourceLabel","sourceUrl","observedAt","displayOrder","isPublic","reviewStatus",
           "createdAt","updatedAt","kolHandle","tokenSymbol","localFilePath","sha256","sessionId","notes")
        VALUES
          (gen_random_uuid()::text, ${e.relationType}, ${e.relationKey}, ${e.snapshotType}, NULL,
           ${e.title}, ${e.caption}, ${e.sourceLabel}, ${e.sourceUrl}, ${observedAt}, ${e.displayOrder},
           ${e.isPublic}, ${e.reviewStatus}, now(), now(), ${e.kolHandle}, ${e.tokenSymbol},
           ${e.localFilePath}, ${e.sha256}, ${e.sessionId}, ${notes})
        ON CONFLICT ("sha256") DO NOTHING`)
      if (n === 1) report.evidences.inserted++; else report.evidences.skipped_existing++
    } catch (err) { report.evidences.failed.push({ sha256: e.sha256, error: err.message }) }
  }
}

async function main() {
  dbHostGuard()
  await preflight()
  await seedKol()
  await seedLinks()
  await seedEvidences()
  report.finishedAt = new Date().toISOString()
  const { writeFileSync } = await import('node:fs')
  writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}
main().catch(e => { console.error('SEED FAILED:', e.message); process.exit(1) }).finally(() => prisma.$disconnect())
