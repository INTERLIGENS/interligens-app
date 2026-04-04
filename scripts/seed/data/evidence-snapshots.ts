import fs from 'fs'
const envLocal = fs.readFileSync('.env.local', 'utf8')
const dbUrl = envLocal.match(/DATABASE_URL="([^"]+)"/)?.[1]
if (dbUrl) process.env.DATABASE_URL = dbUrl

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

interface SnapshotEntry {
  relationType: string
  relationKey: string
  snapshotType: string
  title: string
  caption: string
  sourceLabel?: string
  sourceUrl?: string
  observedAt?: string
  displayOrder: number
  isPublic: boolean
  reviewStatus: string
}

const SNAPSHOTS: SnapshotEntry[] = [
  // BOTIFY-MAIN dossier
  {
    relationType: 'case',
    relationKey: 'BOTIFY-MAIN',
    snapshotType: 'document_excerpt',
    title: 'BOTIFY Internal Document — F&F Wallet Assignments',
    caption: 'Internal BOTIFY document confirms Friends & Family wallet pre-allocation to cluster members including bkokoski. Source: leaked document, date confirmed.',
    sourceLabel: 'Leaked BOTIFY internal document',
    observedAt: '2025-03-01',
    displayOrder: 1,
    isPublic: true,
    reviewStatus: 'approved',
  },
  {
    relationType: 'case',
    relationKey: 'BOTIFY-MAIN',
    snapshotType: 'evidence_image',
    title: 'On-chain Cashout Transactions — BK Cluster',
    caption: '28 documented SOL cashout transactions traced from family wallets. Largest single event: $412 on 2025-05-06.',
    sourceLabel: 'Helius RPC — on-chain verified',
    displayOrder: 3,
    isPublic: true,
    reviewStatus: 'approved',
  },

  // BOTIFY dossier
  {
    relationType: 'case',
    relationKey: 'BOTIFY',
    snapshotType: 'tweet_post',
    title: '@planted Public Admission — BOTIFY Voice',
    caption: 'Djordje Stupar publicly acknowledges role as BOTIFY public voice on X, March 19 2025.',
    sourceLabel: 'X / Twitter — @planted',
    observedAt: '2025-03-19',
    displayOrder: 1,
    isPublic: true,
    reviewStatus: 'approved',
  },

  // GHOST dossier
  {
    relationType: 'case',
    relationKey: 'GHOST',
    snapshotType: 'evidence_image',
    title: 'GordonGekko EVM Wallet — Same-Actor Proof',
    caption: 'Direct 55 SOL transfer between wallet 1 and wallet 2 proves single-actor control. EVM address 0xa5B0...1D41 confirmed.',
    sourceLabel: 'On-chain analysis — Solscan',
    displayOrder: 1,
    isPublic: true,
    reviewStatus: 'approved',
  },

  // GHOST-RUG dossier
  {
    relationType: 'case',
    relationKey: 'GHOST-RUG',
    snapshotType: 'document_excerpt',
    title: 'GHOST-RUG — Same Dev Cluster as BOTIFY',
    caption: 'On-chain analysis confirms sxyz500 co-developed GHOST. Same wallet cluster as BOTIFY. Family wallets dumped on retail.',
    sourceLabel: 'On-chain forensic analysis',
    displayOrder: 1,
    isPublic: true,
    reviewStatus: 'approved',
  },

  // SERIAL-12RUGS dossier
  {
    relationType: 'case',
    relationKey: 'SERIAL-12RUGS',
    snapshotType: 'evidence_image',
    title: 'Serial Promotion Pattern — 12+ Documented Rugs',
    caption: 'GOLD1, XMEN, TOBE, PUPPET, EBE, OPENVPP, PREDIC, AMARA, STUDY + 30 others. Source: mariaqueennft investigation, Feb 2026.',
    sourceLabel: 'mariaqueennft — X investigation thread',
    observedAt: '2026-02-01',
    displayOrder: 1,
    isPublic: true,
    reviewStatus: 'approved',
  },
]

async function main() {
  console.log('\n--- EVIDENCE SNAPSHOTS SEED ---\n')
  let created = 0, skipped = 0

  for (const entry of SNAPSHOTS) {
    // Dedup by (relationType, relationKey, title)
    const existing = await prisma.evidenceSnapshot.findFirst({
      where: { relationType: entry.relationType, relationKey: entry.relationKey, title: entry.title },
    })

    if (existing) {
      console.log(`  = ${entry.relationKey} / ${entry.title.slice(0, 40)}... skipped`)
      skipped++
      continue
    }

    await prisma.evidenceSnapshot.create({
      data: {
        relationType: entry.relationType,
        relationKey: entry.relationKey,
        snapshotType: entry.snapshotType,
        title: entry.title,
        caption: entry.caption,
        sourceLabel: entry.sourceLabel,
        observedAt: entry.observedAt ? new Date(entry.observedAt) : null,
        displayOrder: entry.displayOrder,
        isPublic: entry.isPublic,
        reviewStatus: entry.reviewStatus,
      },
    })
    console.log(`  + ${entry.relationKey} / ${entry.title.slice(0, 40)}...`)
    created++
  }

  console.log(`\n  Created: ${created} | Skipped: ${skipped}`)
  console.log('\n--- DONE ---\n')
  await prisma.$disconnect()
}

main()
