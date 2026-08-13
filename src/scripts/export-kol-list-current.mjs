// READ-ONLY export — KOL list current state (Host-001).
// NO writes. NO migrations. SELECT-only. Produces a flat CSV.
//
// Usage:
//   set -a; . ./.env.local; set +a; node src/scripts/export-kol-list-current.mjs
//
// Output: exports/kol_list_current_2026-06-17.csv

import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync } from 'node:fs'

const prisma = new PrismaClient()

// HARD OPSEC RULE: these 5 P0 profiles must NEVER appear in this export.
const P0_EXCLUDE = new Set(['GordonGekko', 'sxyz500', 'bkokoski', 'planted', 'DonWedge'])

const OUT = 'exports/kol_list_current_2026-06-17.csv'

function csvCell(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

// Normalise a name/handle for dup heuristic: lowercase, strip non-alphanum.
function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

async function main() {
  // ── 1. Profiles (typed via prisma client) ───────────────────────────────
  const profiles = await prisma.kolProfile.findMany({
    select: {
      handle: true, displayName: true, followerCount: true,
      pdfScore: true, publishStatus: true, evidenceStatus: true, status: true,
    },
  })
  const kept = profiles.filter((p) => !P0_EXCLUDE.has(p.handle))

  // ── 2. Token links — REAL counts, grouped per handle ────────────────────
  const links = await prisma.kolTokenLink.findMany({
    select: { kolHandle: true, tokenSymbol: true },
  })
  const linkMap = new Map() // handle -> { count, tickers:Set }
  for (const l of links) {
    if (P0_EXCLUDE.has(l.kolHandle)) continue
    let e = linkMap.get(l.kolHandle)
    if (!e) { e = { count: 0, tickers: new Set() }; linkMap.set(l.kolHandle, e) }
    e.count++
    if (l.tokenSymbol) e.tickers.add(l.tokenSymbol)
  }

  // ── 3. last_session per handle (drifted forensic cols on EvidenceSnapshot)─
  // These columns are NOT in the prisma client → raw SQL, guarded by a
  // information_schema probe so the export never crashes if the migration
  // hasn't run on this DB.
  const sessionMap = new Map() // handle -> sessionId
  let sessionColsPresent = false
  try {
    const cols = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'EvidenceSnapshot'
         AND column_name IN ('kolHandle','sessionId','createdAt')`)
    sessionColsPresent = cols.length === 3
    if (sessionColsPresent) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT DISTINCT ON ("kolHandle") "kolHandle", "sessionId"
         FROM "EvidenceSnapshot"
         WHERE "kolHandle" IS NOT NULL AND "sessionId" IS NOT NULL
         ORDER BY "kolHandle", "createdAt" DESC`)
      for (const r of rows) sessionMap.set(r.kolHandle, r.sessionId)
    }
  } catch (e) {
    console.error('WARN: session lookup skipped:', e.message)
  }

  // ── 4. dup_suspect heuristic ─────────────────────────────────────────────
  // Group kept profiles by normalised displayName; if 2+ share one, they are
  // mutual dup_suspects. NEVER merged — only flagged.
  const byName = new Map()
  for (const p of kept) {
    const key = norm(p.displayName)
    if (!key) continue
    if (!byName.has(key)) byName.set(key, [])
    byName.get(key).push(p.handle)
  }
  const dupMap = new Map() // handle -> suspected dup handle(s)
  for (const [, handles] of byName) {
    if (handles.length < 2) continue
    for (const h of handles) {
      dupMap.set(h, handles.filter((x) => x !== h).join('|'))
    }
  }
  // Explicit known suspect pair flagged in the task (CookerFlips <-> theonomix).
  const knownPairs = [['CookerFlips', 'theonomix']]
  const haveHandle = new Set(kept.map((p) => p.handle))
  for (const [a, b] of knownPairs) {
    if (haveHandle.has(a) && haveHandle.has(b)) {
      const add = (x, y) => {
        const cur = dupMap.get(x)
        const set = new Set(cur ? cur.split('|') : [])
        set.add(y)
        dupMap.set(x, [...set].join('|'))
      }
      add(a, b); add(b, a)
    }
  }

  // ── 5. assemble rows ─────────────────────────────────────────────────────
  const rows = kept.map((p) => {
    const lk = linkMap.get(p.handle)
    const nb = lk ? lk.count : 0
    const tickers = lk ? [...lk.tickers].sort() : []
    const niveau = nb >= 3 ? 'CHAUD' : nb >= 1 ? 'TIEDE' : 'FROID'
    return {
      handle: p.handle,
      displayName: p.displayName,
      followers: p.followerCount ?? 0,
      tigerScore: p.pdfScore, // proxy: no stored TigerScore column exists
      nb_token_links: nb,
      tickers: tickers.join('|'),
      niveau,
      publishStatus: p.publishStatus,
      evidenceStatus: p.evidenceStatus,
      last_session: sessionMap.get(p.handle) || '',
      dup_suspect: dupMap.get(p.handle) || '',
    }
  })

  // Sort: nb_token_links DESC, then followers DESC.
  rows.sort((a, b) => b.nb_token_links - a.nb_token_links || b.followers - a.followers)

  // ── 6. write CSV ─────────────────────────────────────────────────────────
  const header = ['handle', 'displayName', 'followers', 'tigerScore',
    'nb_token_links', 'tickers', 'niveau', 'publishStatus', 'evidenceStatus',
    'last_session', 'dup_suspect']
  const lines = [header.join(',')]
  for (const r of rows) lines.push(header.map((h) => csvCell(r[h])).join(','))
  mkdirSync('exports', { recursive: true })
  writeFileSync(OUT, lines.join('\n') + '\n')

  // ── 7. report ────────────────────────────────────────────────────────────
  const chaud = rows.filter((r) => r.niveau === 'CHAUD').length
  const tiede = rows.filter((r) => r.niveau === 'TIEDE').length
  const froid = rows.filter((r) => r.niveau === 'FROID').length
  const dups = rows.filter((r) => r.dup_suspect)
    .map((r) => `${r.handle} <-> ${r.dup_suspect}`)
  console.log(JSON.stringify({
    out: OUT,
    total_rows: rows.length,
    excluded_P0: profiles.filter((p) => P0_EXCLUDE.has(p.handle)).map((p) => p.handle),
    CHAUD: chaud, TIEDE: tiede, FROID: froid,
    session_cols_present: sessionColsPresent,
    handles_with_session: sessionMap.size,
    dup_suspects: dups,
  }, null, 2))
}

main()
  .catch((e) => { console.error('EXPORT FAILED:', e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
