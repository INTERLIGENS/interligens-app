import fs from 'fs'
import path from 'path'

const envLocal = fs.readFileSync('.env.local', 'utf8')
const dbUrl = envLocal.match(/DATABASE_URL="([^"]+)"/)?.[1]
if (dbUrl) process.env.DATABASE_URL = dbUrl
for (const line of envLocal.split('\n')) {
  const m = line.match(/^(R2_[A-Z_]+)="([^"]+)"/)
  if (m) process.env[m[1]] = m[2]
}
process.env.PDF_STORAGE_ENABLED = 'true'

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BUCKET = process.env.R2_BUCKET_NAME ?? 'interligens-rawdocs'
const R2_PUBLIC_BASE = process.env.R2_PUBLIC_URL ?? 'https://pub-interligens.r2.dev'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

async function r2Exists(key: string): Promise<boolean> {
  try { await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })); return true }
  catch { return false }
}

async function r2Upload(key: string, body: Buffer): Promise<string> {
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: body, ContentType: 'image/png',
    Metadata: { 'captured-by': 'interligens-osint-upload' },
  }))
  return `${R2_PUBLIC_BASE}/${key}`
}

const SRC_DIR = path.join(process.env.HOME!, 'Desktop', 'CASES INTERLIGENS', 'BOTIFY SCAM')
const FILES = ['IMG_0647.PNG','IMG_0648.PNG','IMG_0649.PNG','IMG_0650.PNG','IMG_0651.PNG','IMG_0652.PNG','IMG_0653.PNG','IMG_0654.PNG','IMG_0655.PNG','IMG_0656.PNG']

interface SnapshotDef {
  file: string
  relationType: string
  relationKey: string
  snapshotType: string
  title: string
  caption: string
  sourceLabel: string
  observedAt: string
  displayOrder: number
}

const SNAPSHOTS: SnapshotDef[] = [
  {
    file: 'IMG_0647.PNG',
    relationType: 'case', relationKey: 'BOTIFY-MAIN',
    snapshotType: 'document_excerpt',
    title: 'BOTIFY Internal Pitch Deck — KOL & Advisor List',
    caption: "Internal BOTIFY document lists advisors including Edu Rio and Sam O'Leary, and KOLs 'On Board Already' including PaoloG, MoonKing, 0xDale, James Bull, Brommy, Sibel, Jamma Pelson, AnonymousCFS, Cheatcoiner — confirming coordinated launch structure.",
    sourceLabel: 'BOTIFY internal document — source: mariaqueennft',
    observedAt: '2025-03-01', displayOrder: 1,
  },
  {
    file: 'IMG_0649.PNG',
    relationType: 'case', relationKey: 'BOTIFY-MAIN',
    snapshotType: 'document_excerpt',
    title: 'BOTIFY F&F Wallet Allocation — 60+ Entries',
    caption: 'Internal document shows Friends & Family wallet pre-allocation list with 60+ entries, each with SOL amount and wallet address. Confirms pre-launch insider token distribution.',
    sourceLabel: 'BOTIFY internal document — source: mariaqueennft',
    observedAt: '2025-03-01', displayOrder: 2,
  },
  {
    file: 'IMG_0651.PNG',
    relationType: 'case', relationKey: 'BOTIFY-MAIN',
    snapshotType: 'document_excerpt',
    title: 'BOTIFY Internal Doc — BK & SAM Family Wallet Assignments',
    caption: 'Document explicitly lists BK cluster wallets (Illya, Mom, Dad, Carter, Jon, Azeem) and SAM cluster wallets (Dad, Nick, Simon, Rut, Chad, Ben, Evan, Mum) with wallet addresses — directly corroborating on-chain cashout evidence.',
    sourceLabel: 'BOTIFY internal document — source: mariaqueennft',
    observedAt: '2025-03-01', displayOrder: 3,
  },
  {
    file: 'IMG_0655.PNG',
    relationType: 'case', relationKey: 'BOTIFY-MAIN',
    snapshotType: 'document_excerpt',
    title: 'BOTIFY KOL Payment Records — TX Hashes on Solscan',
    caption: 'Internal spreadsheet documents KOL payments with amounts, frequencies, Solana wallet addresses and Solscan transaction links — providing on-chain verifiable payment evidence.',
    sourceLabel: 'BOTIFY internal document — source: mariaqueennft',
    observedAt: '2025-03-01', displayOrder: 4,
  },
  {
    file: 'IMG_0648.PNG',
    relationType: 'case', relationKey: 'BOTIFY',
    snapshotType: 'document_excerpt',
    title: 'BOTIFY Internal Doc — Full KOL Network Confirmed',
    caption: 'The same internal document confirms the full BOTIFY KOL network including DonWedge, GordonGekko, planted and others as coordinated participants in the launch.',
    sourceLabel: 'BOTIFY internal document — source: mariaqueennft',
    observedAt: '2025-03-01', displayOrder: 1,
  },
]

async function main() {
  console.log('\n=== BOTIFY DOCUMENT UPLOAD ===\n')

  // Step 1 — Upload all 10 images to R2
  const urlMap = new Map<string, string>()

  for (const file of FILES) {
    const r2Key = `evidence/botify-main/leaked-doc/${file}`
    const filePath = path.join(SRC_DIR, file)

    if (!fs.existsSync(filePath)) {
      console.log(`  ! ${file} not found locally`)
      continue
    }

    const exists = await r2Exists(r2Key)
    if (exists) {
      const url = `${R2_PUBLIC_BASE}/${r2Key}`
      console.log(`  = ${file} (already in R2)`)
      urlMap.set(file, url)
    } else {
      try {
        const body = fs.readFileSync(filePath)
        const url = await r2Upload(r2Key, body)
        console.log(`  + ${file} (${(body.length / 1024).toFixed(0)} KB)`)
        urlMap.set(file, url)
      } catch (e: any) {
        console.log(`  ! ${file} upload failed: ${e.message?.slice(0, 80)}`)
      }
    }
  }

  // Step 2 — Upsert EvidenceSnapshot records
  console.log('\n--- Upserting snapshot records ---\n')

  for (const s of SNAPSHOTS) {
    const imageUrl = urlMap.get(s.file) ?? null

    const existing = await prisma.evidenceSnapshot.findFirst({
      where: { relationType: s.relationType, relationKey: s.relationKey, title: s.title },
    })

    if (existing) {
      if (imageUrl && !existing.imageUrl) {
        await prisma.evidenceSnapshot.update({ where: { id: existing.id }, data: { imageUrl } })
        console.log(`  ~ updated imageUrl: ${s.title.slice(0, 55)}...`)
      } else {
        console.log(`  = exists: ${s.title.slice(0, 55)}...`)
      }
    } else {
      await prisma.evidenceSnapshot.create({
        data: {
          relationType: s.relationType,
          relationKey: s.relationKey,
          snapshotType: s.snapshotType,
          imageUrl,
          title: s.title,
          caption: s.caption,
          sourceLabel: s.sourceLabel,
          observedAt: new Date(s.observedAt),
          displayOrder: s.displayOrder,
          isPublic: true,
          reviewStatus: 'approved',
        },
      })
      console.log(`  + created: ${s.title.slice(0, 55)}...`)
    }
  }

  // Step 3 — Update KolEvidence for bkokoski
  console.log('\n--- Updating KolEvidence ---\n')

  const kolEv = await prisma.kolEvidence.findFirst({
    where: { kolHandle: 'bkokoski', dedupKey: 'botify-doc-bk-ff-wallet-2025' },
  })
  if (kolEv) {
    const docUrl = urlMap.get('IMG_0651.PNG')
    if (docUrl) {
      await prisma.kolEvidence.update({
        where: { id: kolEv.id },
        data: { sourceUrl: docUrl, description: (kolEv.description ?? '') + ' Full document now in evidence with R2 archive.' },
      })
      console.log('  ~ bkokoski evidence updated with R2 URL')
    } else {
      console.log('  = bkokoski evidence — no URL to add')
    }
  } else {
    console.log('  - bkokoski evidence record not found')
  }

  // Also check sxyz500
  const kolEvSam = await prisma.kolEvidence.findFirst({
    where: { kolHandle: 'sxyz500', dedupKey: 'botify-doc-sam-ff-wallet-2025' },
  })
  if (kolEvSam) {
    const docUrl = urlMap.get('IMG_0651.PNG')
    if (docUrl) {
      await prisma.kolEvidence.update({
        where: { id: kolEvSam.id },
        data: { sourceUrl: docUrl, description: (kolEvSam.description ?? '') + ' Full document now in evidence with R2 archive.' },
      })
      console.log('  ~ sxyz500 evidence updated with R2 URL')
    } else {
      console.log('  = sxyz500 evidence — no URL to add')
    }
  } else {
    console.log('  - sxyz500 evidence record not found')
  }

  console.log('\n=== DONE ===\n')
  await prisma.$disconnect()
}

main()
