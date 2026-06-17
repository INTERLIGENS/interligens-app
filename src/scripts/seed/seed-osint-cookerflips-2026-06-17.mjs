// Commit-time seeder for OSINT session 2026-06-17_cookerflips
// Usage (after "go commit"):
//   set -a; . ./.env.local; set +a; node src/scripts/seed/seed-osint-cookerflips-2026-06-17.mjs
//
// Idempotent: EvidenceSnapshot guarded by UNIQUE(sha256) -> ON CONFLICT DO NOTHING.
// KolProfile/KolTokenLink via upsert. NO negatives this session.
// observedAt = file CAPTURE timestamp (from filename) interpreted Asia/Makassar UTC+8.
// Captures are X SEARCH-RESULT pages (Top tab) -> visible tweet dates go in notes as a range.

import { PrismaClient, Prisma } from '@prisma/client'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'

const SESSION = '2026-06-17_cookerflips'
const HANDLE = 'CookerFlips'
const BASE = '/Users/dood/Desktop/OSINT/@CookerFlips ' // trailing space intentional
const REPORT = 'exports/seed_report_2026-06-17_cookerflips.json'

const TICKERS = [
  { dir: '1_TROLL', sym: 'TROLL' },
  { dir: '2_ASTER', sym: 'ASTER' },
  { dir: '4_ASTEROID', sym: 'ASTEROID' },
  { dir: '10_NEET', sym: 'NEET' },
  { dir: '12_WOjAK', sym: 'WOJAK' },
  { dir: '13_VINE', sym: 'VINE' },
]

// tweetsVisible notes keyed by HH.MM.SS (from vision pass). ASCII only.
const TWEETS = {
  '08.41.39': 'tweets visibles: "May 25" (annee masquee), top $TROLL',
  '08.41.46': 'tweets visibles: "May 4" (masquee), + May 2 2024, Feb 17 2021',
  '08.41.48': 'tweets visibles: Apr 30 2021 (top), Feb 21 2021',
  '08.44.16': 'tweet deroule (pas page de recherche): $ASTER Sep 21 2025, + Mar 27 2025',
  '08.44.58': 'tweets visibles ~Mar-Oct 2025: top "Apr 23" (masquee), + Apr 20, Sep 21 2025',
  '08.45.04': 'tweets visibles: Sep 21 2025 (top), Oct 11 2025',
  '08.45.06': 'tweets visibles: Oct 11 2025 (top), "Mar 24" (masquee)',
  '08.45.12': 'tweets visibles: "Mar 24" (masquee, top), "Mar 17"',
  '08.45.23': 'tweets visibles: "Mar 6" (masquee, top)',
  '08.45.26': 'tweets visibles: Sep 26 2025 (top), Sep 15/21, Oct 4 2025',
  '08.45.32': 'tweets visibles: Sep 19 2025 (top), Sep 28 2025',
  '08.45.35': 'tweets visibles: Sep 20 2025 (top), Oct 14 2025',
  '08.45.42': 'tweets visibles: "Sep 18" (masquee, top), Sep 25 2025',
  '08.45.46': 'tweets visibles: "Mar 7" (masquee, top), Sep 23 2025, Oct 11 2025',
  '08.45.52': 'tweets visibles: Sep 21 2025 (top)',
  '08.45.54': 'tweets visibles: Sep 18 2025 (top), Sep 21/25 2025',
  '08.45.58': 'tweets visibles: Sep 26 2025 (top), Sep 22/25 2025',
  '08.46.00': 'tweets visibles: Sep 20 2025 (top), Sep 16/23/27 2025',
  '08.46.03': 'tweets visibles: Oct 1 2025 (top), Sep 24/29 2025',
  '08.46.05': 'tweets visibles: Sep 25 2025 (top), Sep 26 2025',
  '08.46.07': 'tweets visibles: Sep 25 2025 (top), Sep 17 2025',
  '08.46.10': 'tweets visibles: Sep 26 2025 (top), Sep 18/27 2025',
  '08.46.13': 'tweets visibles: Sep 21 2025 (top)',
  '08.46.19': 'tweets visibles: Sep 23 2025 (top), Sep 20 2025',
  '08.46.22': 'tweets visibles: Sep 25 2025 (top)',
  '08.46.24': 'tweets visibles: Sep 23 2025 (top), Sep 18, Oct 1/5 2025',
  '08.46.26': 'tweets visibles: Sep 21 2025 (top), Sep 20/24 2025',
  '08.46.28': 'tweets visibles: Sep 21 2025 (top), Sep 22 2025',
  '08.46.31': 'tweets visibles: Sep 23 2025 (top), Sep 26 2025',
  '08.47.29': 'tweets visibles ~Apr-Jun (annee masquee): top "May 19"',
  '08.47.32': 'tweets visibles ~Apr-Jun (annee masquee): top "Apr 23", "Apr 17"',
  '08.47.37': 'tweets visibles ~Apr-Jun (annee masquee): top "Apr 21"',
  '08.47.40': 'tweets visibles ~Apr-Jun (annee masquee): top "Apr 24", "May 12", "Apr 28"',
  '08.47.42': 'tweets visibles ~Apr-Jun (annee masquee): top "Apr 19"',
  '08.47.45': 'tweets visibles ~Apr-Jun (annee masquee): top "Apr 29", "May 5/8/11"',
  '08.47.48': 'tweets visibles ~Apr-Jun (annee masquee): top "May 17", "May 9"',
  '08.47.51': 'tweets visibles ~Apr-Jun (annee masquee): top "May 5", "Apr 20/21"',
  '08.47.55': 'tweets visibles ~Apr-Jun (annee masquee): top "May 7", "Apr 16/17/19"',
  '08.47.58': 'tweets visibles ~Apr-Jun (annee masquee): top "Jun 17", "Apr 15"',
  '08.48.00': 'tweets visibles ~Apr-Jun (annee masquee): top "Apr 18"; token "Asteroid The Space Shiba Inu"',
  '08.48.02': 'tweets visibles ~Apr-Jun (annee masquee): "Apr 22" (bas de page), mentionne SOL',
  '08.51.52': 'tweets visibles: "Apr 12" (masquee, top), Jul 31 2024',
  '08.51.55': 'tweets visibles: Jul 31 2024 (top), Jun 8',
  '08.53.45': 'tweets visibles: "May 1" (masquee, top), + Jul 26 2025, Sep 25 2024, Apr 24, May 4',
  '08.53.48': 'tweets visibles: Sep 25 2024 (top), Dec 10 2020',
  '08.53.51': 'tweets visibles: Apr 23 2023 (profits listes en ETH)',
  '08.53.53': 'AMBIGUITE date: en-tete "Apr 25 2023" vs carte P/L "2023-04-26 12:50:38" (short WOJAK 4X); les deux conservees',
  '08.54.22': 'tweets visibles: Mar 26 2025 (top), Jan 25 2025',
}

const prisma = new PrismaClient()
const report = { session: SESSION, startedAt: new Date().toISOString(), dbHost: null,
  kolProfile: null, kolTokenLinks: { ok: 0, failed: [] },
  evidences: { inserted: 0, skipped_existing: 0, missing_note: [], failed: [] }, notes: [] }

function buildPlan() {
  const evidences = []
  const links = []
  for (const t of TICKERS) {
    const folder = BASE + '/' + t.dir
    const files = readdirSync(folder).filter(f => f.toLowerCase().endsWith('.png')).sort()
    links.push({
      kolHandle: HANDLE, contractAddress: `PENDING:${t.sym}`, chain: 'unknown', tokenSymbol: t.sym,
      role: 'promoter', documentationStatus: 'partial',
      attributionNote: `Contract address + chain pending resolution. Linked from OSINT session ${SESSION} (X search evidence, onglet Top).`,
      note: 'Created from CookerFlips OSINT screenshots; CA + chain to be resolved at DexScreener enrichment.',
    })
    let order = 0
    for (const f of files) {
      order++
      const full = folder + '/' + f
      const m = f.match(/(\d{4}-\d{2}-\d{2}).*?(\d{2})\.(\d{2})\.(\d{2})\.png$/)
      if (!m) throw new Error(`Cannot parse capture time from filename: ${f}`)
      const iso = `${m[1]}T${m[2]}:${m[3]}:${m[4]}+08:00`
      const tkey = `${m[2]}.${m[3]}.${m[4]}`
      const tv = TWEETS[tkey]
      if (!tv) { report.evidences.missing_note.push(f); }
      const buf = readFileSync(full)
      const sha256 = createHash('sha256').update(buf).digest('hex')
      const q = t.sym.toLowerCase()
      const sourceUrl = `https://x.com/search?q=from%3ACookerFlips%20${q}&src=typed_query`
      const notes = `tz=Asia/Makassar(UTC+8); sourceUrl=reconstruite; tab=Top(algorithmique,non-reproductible); ${tv || 'tweetsVisible=UNRESOLVED'}; bytes=${buf.length}; origName=${f}`
      evidences.push({
        relationType: 'kol_token', relationKey: `${HANDLE}:${t.sym}`, snapshotType: 'osint_x_search',
        title: `${HANDLE} × $${t.sym} — X search evidence`,
        caption: `Screenshot of x.com search "from:CookerFlips ${q}" (onglet Top) captured ${iso} (Asia/Makassar UTC+8)`,
        sourceLabel: 'X (Twitter) search - manual OSINT (URL reconstruite, onglet Top algorithmique non-reproductible)',
        sourceUrl, observedAt: iso, displayOrder: order, isPublic: false, reviewStatus: 'approved',
        kolHandle: HANDLE, tokenSymbol: t.sym, localFilePath: full, sha256, sessionId: SESSION, notes,
      })
    }
  }
  return { evidences, links }
}

async function preflight() {
  const host = (process.env.DATABASE_URL || '').match(/@([^.]+)/)
  report.dbHost = host ? host[1] : 'UNKNOWN'
  if (!(process.env.DATABASE_URL || '').includes('ep-square-band')) {
    throw new Error(`Wrong DB host (${report.dbHost}). Refusing: only ep-square-band allowed.`)
  }
  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name='EvidenceSnapshot' AND column_name IN ('sha256','localFilePath','sessionId','kolHandle','tokenSymbol','notes')`)
  if (cols.length < 6) throw new Error(`Missing forensic columns (${cols.length}/6).`)
}

async function seedKol() {
  const row = await prisma.kolProfile.upsert({
    where: { handle: HANDLE },
    update: {}, // no-clobber existing profile
    create: { handle: HANDLE, platform: 'x', displayName: 'CookerFlips',
      evidenceStatus: 'partial', publishable: false, publishStatus: 'draft',
      internalNote: `Auto-created from OSINT session ${SESSION}. Not for publish.` },
  })
  report.kolProfile = { handle: row.handle, id: row.id }
}

async function seedLinks(links) {
  for (const l of links) {
    try {
      await prisma.kolTokenLink.upsert({
        where: { kolHandle_contractAddress_chain: { kolHandle: l.kolHandle, contractAddress: l.contractAddress, chain: l.chain } },
        update: {},
        create: l,
      })
      report.kolTokenLinks.ok++
    } catch (e) { report.kolTokenLinks.failed.push({ tokenSymbol: l.tokenSymbol, error: e.message }) }
  }
}

async function seedEvidences(evidences) {
  for (const e of evidences) {
    try {
      const observedAt = new Date(e.observedAt)
      const res = await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "EvidenceSnapshot"
          ("id","relationType","relationKey","snapshotType","imageUrl","title","caption",
           "sourceLabel","sourceUrl","observedAt","displayOrder","isPublic","reviewStatus",
           "createdAt","updatedAt","kolHandle","tokenSymbol","localFilePath","sha256","sessionId","notes")
        VALUES
          (gen_random_uuid()::text, ${e.relationType}, ${e.relationKey}, ${e.snapshotType}, NULL,
           ${e.title}, ${e.caption}, ${e.sourceLabel}, ${e.sourceUrl}, ${observedAt}, ${e.displayOrder},
           ${e.isPublic}, ${e.reviewStatus}, now(), now(), ${e.kolHandle}, ${e.tokenSymbol},
           ${e.localFilePath}, ${e.sha256}, ${e.sessionId}, ${e.notes})
        ON CONFLICT ("sha256") DO NOTHING`)
      if (res === 0) report.evidences.skipped_existing++; else report.evidences.inserted++
    } catch (err) { report.evidences.failed.push({ sha256: e.sha256, tokenSymbol: e.tokenSymbol, error: err.message }) }
  }
}

try {
  const { evidences, links } = buildPlan()
  if (evidences.length !== 48) throw new Error(`Expected 48 evidences, built ${evidences.length}.`)
  if (report.evidences.missing_note.length) throw new Error(`Missing tweetsVisible note for: ${report.evidences.missing_note.join(', ')}`)
  await preflight()
  await seedKol()
  await seedLinks(links)
  await seedEvidences(evidences)
  report.finishedAt = new Date().toISOString()
  report.ok = report.kolTokenLinks.failed.length === 0 && report.evidences.failed.length === 0
  writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ dbHost: report.dbHost, kol: report.kolProfile?.handle,
    links_ok: report.kolTokenLinks.ok, evidences_inserted: report.evidences.inserted,
    evidences_skipped: report.evidences.skipped_existing, evidences_failed: report.evidences.failed.length,
    ok: report.ok }, null, 2))
} catch (e) {
  console.error('SEED ABORTED:', e.message)
  process.exitCode = 1
} finally { await prisma.$disconnect() }
