import fs from 'fs'
const envLocal = fs.readFileSync('.env.local', 'utf8')
const dbUrl = envLocal.match(/DATABASE_URL="([^"]+)"/)?.[1]
if (dbUrl) process.env.DATABASE_URL = dbUrl

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

interface TokenLinkEntry {
  kolHandle: string
  tokenSymbol: string
  chain: string
  role: string
  caseId: string
  documentationStatus: string
  note: string
}

const TOKEN_LINKS: TokenLinkEntry[] = [
  // bkokoski
  {
    kolHandle: 'bkokoski',
    tokenSymbol: 'BOTIFY',
    chain: 'SOL',
    role: 'deployer',
    caseId: 'BOTIFY-MAIN',
    documentationStatus: 'documented',
    note: 'Co-founder BOTIFY. Family wallets received pre-launch supply per leaked doc.',
  },
  {
    kolHandle: 'bkokoski',
    tokenSymbol: 'GHOST',
    chain: 'SOL',
    role: 'deployer',
    caseId: 'GHOST-RUG',
    documentationStatus: 'documented',
    note: 'Same dev cluster as BOTIFY confirmed by on-chain analysis.',
  },
  {
    kolHandle: 'bkokoski',
    tokenSymbol: 'SERIAL-12RUGS',
    chain: 'SOL',
    role: 'promoter',
    caseId: 'SERIAL-12RUGS',
    documentationStatus: 'documented',
    note: '12+ confirmed rug-linked promotions. Source: mariaqueennft Feb 2026.',
  },

  // sxyz500
  {
    kolHandle: 'sxyz500',
    tokenSymbol: 'BOTIFY',
    chain: 'SOL',
    role: 'deployer',
    caseId: 'BOTIFY-MAIN',
    documentationStatus: 'documented',
    note: 'Co-developer BOTIFY. Dad wallet received full supply allocation and dumped.',
  },
  {
    kolHandle: 'sxyz500',
    tokenSymbol: 'GHOST',
    chain: 'SOL',
    role: 'deployer',
    caseId: 'GHOST-RUG',
    documentationStatus: 'documented',
    note: 'Co-developer GHOST. Same cluster as bkokoski confirmed.',
  },

  // GordonGekko
  {
    kolHandle: 'GordonGekko',
    tokenSymbol: 'BOTIFY',
    chain: 'SOL',
    role: 'promoter',
    caseId: 'BOTIFY',
    documentationStatus: 'documented',
    note: 'Co-promotion BOTIFY. Network overlap BK cluster.',
  },
  {
    kolHandle: 'GordonGekko',
    tokenSymbol: 'GHOST',
    chain: 'SOL',
    role: 'promoter',
    caseId: 'GHOST',
    documentationStatus: 'documented',
    note: 'GHOST overlap cross-ref lynk0x ongoing.',
  },

  // planted
  {
    kolHandle: 'planted',
    tokenSymbol: 'BOTIFY',
    chain: 'SOL',
    role: 'promoter',
    caseId: 'BOTIFY',
    documentationStatus: 'partial',
    note: 'Promotion alongside bkokoski during BOTIFY active period.',
  },
  {
    kolHandle: 'planted',
    tokenSymbol: 'GHOST',
    chain: 'SOL',
    role: 'promoter',
    caseId: 'GHOST',
    documentationStatus: 'partial',
    note: 'GHOST overlap with BK/SAM cluster. Under investigation.',
  },

  // DonWedge
  {
    kolHandle: 'DonWedge',
    tokenSymbol: 'BOTIFY',
    chain: 'SOL',
    role: 'promoter',
    caseId: 'BOTIFY',
    documentationStatus: 'partial',
    note: 'Promotion overlap BK cluster. Cashout under review.',
  },

  // lynk0x
  {
    kolHandle: 'lynk0x',
    tokenSymbol: 'GHOST',
    chain: 'SOL',
    role: 'promoter',
    caseId: 'GHOST',
    documentationStatus: 'partial',
    note: 'GHOST overlap cross-ref with GordonGekko ongoing.',
  },
]

async function main() {
  console.log('\n--- TOKEN LINK DENSIFICATION ---\n')

  let created = 0, updated = 0, skipped = 0

  for (const entry of TOKEN_LINKS) {
    // Use PENDING_OSINT_<tokenSymbol> as contractAddress placeholder
    const contractAddress = `PENDING_OSINT_${entry.tokenSymbol}`

    const existing = await prisma.kolTokenLink.findFirst({
      where: { kolHandle: entry.kolHandle, contractAddress, chain: entry.chain },
    })

    if (!existing) {
      await prisma.kolTokenLink.create({
        data: {
          kolHandle: entry.kolHandle,
          contractAddress,
          chain: entry.chain,
          tokenSymbol: entry.tokenSymbol,
          role: entry.role,
          note: entry.note,
          caseId: entry.caseId,
          documentationStatus: entry.documentationStatus,
        },
      })
      console.log(`  + ${entry.kolHandle} → ${entry.tokenSymbol} (${entry.role})`)
      created++
    } else {
      // Upgrade documentation status if better
      const STATUS_ORDER: Record<string, number> = { partial: 0, documented: 1, confirmed: 2 }
      const upgrades: Record<string, unknown> = {}

      if ((STATUS_ORDER[entry.documentationStatus] ?? 0) > (STATUS_ORDER[existing.documentationStatus ?? 'partial'] ?? 0)) {
        upgrades.documentationStatus = entry.documentationStatus
      }
      if (entry.caseId && !existing.caseId) upgrades.caseId = entry.caseId
      if (entry.note && !existing.note) upgrades.note = entry.note

      if (Object.keys(upgrades).length > 0) {
        await prisma.kolTokenLink.update({ where: { id: existing.id }, data: upgrades })
        console.log(`  ~ ${entry.kolHandle} → ${entry.tokenSymbol} upgraded: ${Object.keys(upgrades).join(', ')}`)
        updated++
      } else {
        console.log(`  = ${entry.kolHandle} → ${entry.tokenSymbol} skipped`)
        skipped++
      }
    }
  }

  console.log(`\n  Created: ${created} | Updated: ${updated} | Skipped: ${skipped}`)
  console.log('\n--- DONE ---\n')
  await prisma.$disconnect()
}

main()
