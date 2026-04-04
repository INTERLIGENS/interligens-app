import fs from 'fs'
const envLocal = fs.readFileSync('.env.local', 'utf8')
const dbUrl = envLocal.match(/DATABASE_URL="([^"]+)"/)?.[1]
if (dbUrl) process.env.DATABASE_URL = dbUrl

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface DensifyEntry {
  handle: string
  summary?: string
  observedBehaviorSummary?: string
  documentedFacts?: string
  partialFacts?: string
  behaviorFlags?: string[]
  evidenceDepth?: string
  completenessLevel?: string
  proceedsCoverage?: string
  walletAttributionStrength?: string
  profileStrength?: string
}

const DENSIFY_DATA: DensifyEntry[] = [
  {
    handle: 'bkokoski',
    summary: 'VP/COO of Dione Protocol. Toronto-based. Multiple cashout transactions documented. Internal BOTIFY document confirms wallet assignment within F&F cluster.',
    observedBehaviorSummary: 'Repeated cashout pattern across 28+ documented transactions. Linked to coordinated promotion of multiple Dione-related launches. Internal leaked documents reference direct wallet assignments.',
    documentedFacts: 'BOTIFY leaked document confirms F&F wallet assignment. 28 cashout transactions traced. Dione Protocol executive role verified.',
    partialFacts: 'Full wallet cluster mapping incomplete. Additional linked wallets suspected but unconfirmed.',
    behaviorFlags: ['REPEATED_CASHOUT', 'MULTI_LAUNCH_LINKED', 'COORDINATED_PROMOTION'],
    evidenceDepth: 'strong',
    completenessLevel: 'substantial',
    proceedsCoverage: 'verified',
    walletAttributionStrength: 'high',
    profileStrength: 'strong',
  },
  {
    handle: 'sxyz500',
    summary: 'Linked to Dione Protocol inner circle. BOTIFY leaked document confirms wallet assignment within F&F cluster. Cashout transactions documented.',
    observedBehaviorSummary: 'Repeated cashout pattern. Coordinated promotion activity observed. Internal documents confirm wallet assignment.',
    documentedFacts: 'BOTIFY leaked document confirms F&F wallet assignment. Cashout transactions traced.',
    partialFacts: 'Full proceeds calculation pending. Additional wallet links suspected.',
    behaviorFlags: ['REPEATED_CASHOUT', 'MULTI_LAUNCH_LINKED', 'COORDINATED_PROMOTION'],
    evidenceDepth: 'strong',
    completenessLevel: 'substantial',
    proceedsCoverage: 'partial',
    walletAttributionStrength: 'high',
    profileStrength: 'strong',
  },
  {
    handle: 'GordonGekko',
    summary: 'Linked to same-actor wallet proof (55 SOL pattern). BOTIFY leaked document references involvement.',
    observedBehaviorSummary: 'Same-actor wallet proof identified. Promotion activity documented.',
    documentedFacts: '55 SOL same-actor wallet proof confirmed. BOTIFY leaked document references involvement.',
    partialFacts: 'Full wallet cluster mapping incomplete. Proceeds not fully calculated.',
    behaviorFlags: ['KNOWN_LINKED_WALLETS', 'COORDINATED_PROMOTION'],
    evidenceDepth: 'strong',
    completenessLevel: 'partial',
    proceedsCoverage: 'estimated',
    walletAttributionStrength: 'medium',
    profileStrength: 'standard',
  },
  {
    handle: 'lynk0x',
    summary: 'Shared wallet link with Regrets10x confirmed on-chain. Promotion activity documented.',
    observedBehaviorSummary: 'Known linked wallet shared with Regrets10x. Cross-actor wallet overlap identified.',
    documentedFacts: 'Shared wallet with Regrets10x confirmed on-chain.',
    partialFacts: 'Full wallet mapping and proceeds pending.',
    behaviorFlags: ['KNOWN_LINKED_WALLETS'],
    evidenceDepth: 'moderate',
    completenessLevel: 'partial',
    walletAttributionStrength: 'medium',
    profileStrength: 'basic',
  },
  {
    handle: 'planted',
    summary: 'BOTIFY voice admission documented. Promotion coordination observed.',
    observedBehaviorSummary: 'Voice admission from BOTIFY session recorded. Coordinated promotion patterns.',
    documentedFacts: 'BOTIFY voice admission documented (2025-03-19).',
    partialFacts: 'Wallet attribution and proceeds pending.',
    behaviorFlags: ['COORDINATED_PROMOTION'],
    evidenceDepth: 'moderate',
    completenessLevel: 'partial',
    walletAttributionStrength: 'low',
    profileStrength: 'basic',
  },
  {
    handle: 'Regrets10x',
    summary: 'Shared wallet link with lynk0x confirmed on-chain.',
    documentedFacts: 'Shared wallet with lynk0x confirmed on-chain.',
    partialFacts: 'Full wallet mapping and proceeds pending.',
    behaviorFlags: ['KNOWN_LINKED_WALLETS'],
    evidenceDepth: 'moderate',
    completenessLevel: 'partial',
    walletAttributionStrength: 'medium',
    profileStrength: 'basic',
  },
  // Profiles with leaked doc reference only
  ...['PaoloG', 'JamesBull', 'Brommy', 'Sibel', '0xDale', 'MoonKing'].map(
    (handle): DensifyEntry => ({
      handle,
      summary: 'Referenced in BOTIFY leaked document.',
      documentedFacts: 'BOTIFY leaked document references this actor.',
      partialFacts: 'Wallet attribution, proceeds, and behavioral patterns pending investigation.',
      behaviorFlags: [],
      evidenceDepth: 'weak',
      completenessLevel: 'incomplete',
      profileStrength: 'minimal',
    }),
  ),
  // Profiles with no extra evidence
  ...['DonWedge', 'edurio'].map(
    (handle): DensifyEntry => ({
      handle,
      behaviorFlags: [],
      evidenceDepth: 'weak',
      completenessLevel: 'incomplete',
      profileStrength: 'minimal',
    }),
  ),
]

async function main() {
  console.log('\n--- DENSIFY: Evidence Density Upgrade ---\n')

  for (const entry of DENSIFY_DATA) {
    const { handle, behaviorFlags, ...fields } = entry
    const data: Record<string, unknown> = { ...fields }
    if (behaviorFlags) data.behaviorFlags = JSON.stringify(behaviorFlags)
    data.lastEnrichedAt = new Date()

    try {
      await prisma.kolProfile.update({
        where: { handle },
        data,
      })
      console.log(`  + ${handle} densified (${entry.evidenceDepth ?? 'default'})`)
    } catch (e: any) {
      if (e.code === 'P2025') {
        console.log(`  - ${handle} not found, skipping`)
      } else {
        console.error(`  ! ${handle} error:`, e.message)
      }
    }
  }

  console.log('\n--- DENSIFY COMPLETE ---\n')
  await prisma.$disconnect()
}

main()
