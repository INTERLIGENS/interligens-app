import fs from 'fs'
const envLocal = fs.readFileSync('.env.local', 'utf8')
const dbUrl = envLocal.match(/DATABASE_URL="([^"]+)"/)?.[1]
if (dbUrl) process.env.DATABASE_URL = dbUrl

import {
  mergeWalletAttribution,
  syncKolWalletStrength,
  summarizeWalletCoverage,
  prisma,
  type MergeStats,
} from './walletAttribution'
import { priorityWallets, affectedProfiles } from './data/priority-wallets'

async function main() {
  console.log('\n═══ OSINT WALLET EXPANSION ═══\n')
  console.log(`  ${priorityWallets.length} wallet entries to process\n`)

  const stats: MergeStats = { created: 0, upgraded: 0, skipped: 0 }

  // Group by handle for display
  const grouped = new Map<string, typeof priorityWallets>()
  for (const w of priorityWallets) {
    const arr = grouped.get(w.kolHandle) || []
    arr.push(w)
    grouped.set(w.kolHandle, arr)
  }

  for (const [handle, wallets] of grouped) {
    console.log(`\n► ${handle} (${wallets.length} wallets)`)
    for (const w of wallets) {
      await mergeWalletAttribution(w, stats)
    }
  }

  // Sync wallet attribution strength for all affected profiles
  console.log('\n── Syncing walletAttributionStrength ──')
  for (const handle of affectedProfiles) {
    await syncKolWalletStrength(handle)
  }

  // Coverage summary
  console.log('\n── Coverage Summary ──')
  for (const handle of affectedProfiles) {
    const cov = await summarizeWalletCoverage(handle)
    console.log(`  ${handle}: ${cov.total} wallets (${cov.confirmed} confirmed, ${cov.public} public) chains=[${cov.chains.join(',')}]`)
  }

  console.log('\n──────────────────────────────────────')
  console.log(`  Created:  ${stats.created}`)
  console.log(`  Upgraded: ${stats.upgraded}`)
  console.log(`  Skipped:  ${stats.skipped}`)
  console.log('──────────────────────────────────────\n')

  await prisma.$disconnect()
}

main()
