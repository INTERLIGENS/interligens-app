// Seed: TOES campaign (3 KOL) — manual OSINT ingest 2026-06-26
// Source: $TOESCOIN.zip, 39 captures du 2026-06-20 (@gordongekko 16, @donwedge 16, @moonbag 7).
// CA TOES: FWgBzdGaGZxnS9KGV8q2525kfyrqPyc8mA2Z2ZZqpump (Solana / pump.fun)
// Additive only. ep-square-band. observedAt = file mtime (real fs fact).
// token_casefiles intentionally NOT created (resolver reads KolTokenLink only).
import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'
import { readFileSync, statSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = '/Users/dood/Desktop/OSINT/$TOESCOIN'
const CA = 'FWgBzdGaGZxnS9KGV8q2525kfyrqPyc8mA2Z2ZZqpump'
const CHAIN = 'solana'
const SYMBOL = 'TOES'

// folder (lowercase) -> canonical DB handle (exact case, FK target)
const HANDLES = [
  { folder: '@gordongekko', handle: 'GordonGekko' },
  { folder: '@donwedge', handle: 'DonWedge' },
  { folder: '@moonbag', handle: 'moonbag' },
]

const p = new PrismaClient()
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

async function main() {
  let linksUpserted = 0
  let snapsCreated = 0
  let snapsSkipped = 0

  for (const { folder, handle } of HANDLES) {
    const dir = join(ROOT, folder)
    const pngs = readdirSync(dir).filter((f) => /\.png$/i.test(f)).sort()
    console.log(`\n=== ${handle} (${folder}) — ${pngs.length} png ===`)

    // B. KolTokenLink upsert (compound unique kolHandle+contractAddress+chain)
    await p.kolTokenLink.upsert({
      where: { kolHandle_contractAddress_chain: { kolHandle: handle, contractAddress: CA, chain: CHAIN } },
      update: {}, // never touch if already present
      create: {
        kolHandle: handle,
        contractAddress: CA,
        chain: CHAIN,
        tokenSymbol: SYMBOL,
        role: 'promoter',
        documentationStatus: 'partial',
        note: 'TOES campaign — manual OSINT ingest 2026-06-26',
      },
    })
    linksUpserted++
    console.log(`  KolTokenLink ${handle} -> ${SYMBOL} ok`)

    // A. EvidenceSnapshot per png (dedup on real sha256)
    const relationKey = `${handle}:${SYMBOL}`
    for (const file of pngs) {
      const full = join(dir, file)
      const buf = readFileSync(full)
      const hash = sha256(buf)
      const existing = await p.evidenceSnapshot.findUnique({ where: { sha256: hash } })
      if (existing) {
        snapsSkipped++
        console.log(`  SKIP dup sha256 ${file} (${hash.slice(0, 12)})`)
        continue
      }
      const observedAt = statSync(full).mtime
      await p.evidenceSnapshot.create({
        data: {
          relationType: 'kol_token',
          relationKey,
          snapshotType: 'osint_x_search',
          title: `${handle} × $${SYMBOL} — X search evidence`,
          caption: `Screenshot of x.com search from:${handle} — TOES campaign, captured 2026-06-20 (Asia/Makassar UTC+8).`,
          sourceLabel: 'X (Twitter) search — manual OSINT',
          observedAt,
          isPublic: false,
          reviewStatus: 'approved',
          kolHandle: handle,
          tokenSymbol: SYMBOL,
          localFilePath: full,
          sha256: hash,
          sessionId: `2026-06-20_${handle}_${SYMBOL}`,
          notes: 'TOES campaign capture, manual ingest 2026-06-26',
        },
      })
      snapsCreated++
      console.log(`  +snap ${file} (${hash.slice(0, 12)})`)
    }
  }

  console.log(`\n=== DONE: links upserted=${linksUpserted}, snaps created=${snapsCreated}, skipped(dup)=${snapsSkipped} ===`)
}

main()
  .catch((e) => { console.error('FATAL', e); process.exit(1) })
  .finally(() => p.$disconnect())
