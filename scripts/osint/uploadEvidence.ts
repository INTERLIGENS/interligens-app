import fs from 'fs'
import path from 'path'

const envLocal = fs.readFileSync('.env.local', 'utf8')
const dbUrl = envLocal.match(/DATABASE_URL="([^"]+)"/)?.[1]
if (dbUrl) process.env.DATABASE_URL = dbUrl
// Also load R2 creds
for (const line of envLocal.split('\n')) {
  const m = line.match(/^(R2_[A-Z_]+)="([^"]+)"/)
  if (m) process.env[m[1]] = m[2]
}
process.env.PDF_STORAGE_ENABLED = 'true'

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BUCKET = process.env.R2_BUCKET_NAME ?? 'interligens-rawdocs'
const R2_PUBLIC_BASE = process.env.R2_PUBLIC_URL ?? `https://pub-interligens.r2.dev`

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

async function r2Exists(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch { return false }
}

async function r2Upload(key: string, body: Buffer, contentType: string): Promise<string> {
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    Metadata: { 'captured-by': 'interligens-osint-upload' },
  }))
  return `${R2_PUBLIC_BASE}/${key}`
}

const CASES_DIR = path.join(process.env.HOME!, 'Desktop', 'CASES INTERLIGENS', 'BOTIFY SCAM')

interface UploadMapping {
  localDir: string
  fileIndex: number // 0-based index when sorted by name
  r2Key: string
  dossier: string
  relationType: string
  relationKey: string
  snapshotType: string
  title: string
  caption: string
  sourceLabel: string
  observedAt: string
  displayOrder: number
}

const UPLOAD_MAP: UploadMapping[] = [
  // GHOST dossier — GordonGekko posts
  {
    localDir: 'Gordon (X)',
    fileIndex: 3, // 17.31.08 — GHOST promotion post
    r2Key: 'evidence/ghost/gordon_ghost_promotion_nov2025.png',
    dossier: 'ghost', relationType: 'case', relationKey: 'GHOST',
    snapshotType: 'tweet_post',
    title: '@GordonGekko Promotes $GHOST — Pre-Launch Window',
    caption: "@GordonGekko promotes $GHOST across multiple posts in Nov 2025, stating 'GHOST keeps showing up in the right wallets' and his quant model ranked it the highest match. Posts coincide with pre-launch period.",
    sourceLabel: 'X / @GordonGekko — public posts Nov 2025',
    observedAt: '2025-11-18', displayOrder: 1,
  },
  {
    localDir: 'Gordon (X)',
    fileIndex: 7, // 17.32.08 — HUGE week ahead
    r2Key: 'evidence/ghost/gordon_ghost_huge_week.png',
    dossier: 'ghost', relationType: 'case', relationKey: 'GHOST',
    snapshotType: 'tweet_post',
    title: 'GhostPay Launch Promotion — @GordonGekko Amplification',
    caption: "@GordonGekko retweets GhostPay official launch announcement with 'HUGE week ahead for $GHOST' — coordinated promotion documented.",
    sourceLabel: 'X / @GordonGekko — Nov 25 2025',
    observedAt: '2025-11-25', displayOrder: 2,
  },
  {
    localDir: '@planted : Mr S',
    fileIndex: 0, // 17.36.31 — planted GHOST reply
    r2Key: 'evidence/ghost/planted_ghost_promotion.png',
    dossier: 'ghost', relationType: 'case', relationKey: 'GHOST',
    snapshotType: 'tweet_post',
    title: '@planted Hosts $GHOST Twitter Space — 658 Listeners',
    caption: "Djordje Stupar (@planted) hosts dedicated $GHOST Twitter Space with 658 attendees in Nov 2025, replying to @GordonGekko posts with '$BULLISH on $GHOST'.",
    sourceLabel: 'X / @planted — Nov 2025',
    observedAt: '2025-11-05', displayOrder: 3,
  },
  {
    localDir: 'Gordon (X)',
    fileIndex: 18, // "Meeting BK, Gordon @planted .png"
    r2Key: 'evidence/ghost/meeting_bk_gordon_planted.png',
    dossier: 'ghost', relationType: 'case', relationKey: 'GHOST',
    snapshotType: 'evidence_image',
    title: 'Meeting Proof — BK, GordonGekko, @planted from $DIONE',
    caption: "@GordonGekko posts photo of meeting with @kokoski and @planted, captioned 'just had a HUGE meeting...let's just say the game is about to be CHANGED'. 105.3K views, Apr 30 2025.",
    sourceLabel: 'X / @GordonGekko — Apr 30 2025',
    observedAt: '2025-04-30', displayOrder: 4,
  },

  // BOTIFY dossier — DonWedge posts
  {
    localDir: 'DONWEDGE',
    fileIndex: 0, // 18.07.03 — botify breakout
    r2Key: 'evidence/botify/donwedge_botify_promotion_may2025.png',
    dossier: 'botify', relationType: 'case', relationKey: 'BOTIFY',
    snapshotType: 'tweet_post',
    title: '@DonWedge Promotes $botify — May 2025',
    caption: "@DonWedge publicly promotes $botify with chart analysis: '$botify should breakout soon' (29K views), 'Adding more $botify here', 'adding on to my $botify bag'. Multiple posts May-Jun 2025.",
    sourceLabel: 'X / @DonWedge — May-Jun 2025',
    observedAt: '2025-05-28', displayOrder: 1,
  },
  {
    localDir: 'DONWEDGE',
    fileIndex: 2, // 18.07.29 — adding more
    r2Key: 'evidence/botify/donwedge_botify_adding.png',
    dossier: 'botify', relationType: 'case', relationKey: 'BOTIFY',
    snapshotType: 'tweet_post',
    title: '@DonWedge — Adding More $botify',
    caption: "@DonWedge posts 'Adding more $botify here' and 'adding on to my $botify bag' — repeated promotion pattern May-Jun 2025.",
    sourceLabel: 'X / @DonWedge — Jun 2025',
    observedAt: '2025-06-05', displayOrder: 2,
  },

  // BOTIFY dossier — planted identity
  {
    localDir: '@planted : Mr S',
    fileIndex: 7, // "Djordje Stupar | Mr S.png"
    r2Key: 'evidence/botify/planted_identity.png',
    dossier: 'botify', relationType: 'case', relationKey: 'BOTIFY',
    snapshotType: 'evidence_image',
    title: '@planted Identity Confirmation — Followed by Botify.Cloud and BK',
    caption: "Djordje Stupar (@planted) X profile shows 'Followed by Botify.Cloud and BK' — direct network connection to BOTIFY infrastructure account.",
    sourceLabel: 'X / @planted profile',
    observedAt: '2026-03-21', displayOrder: 3,
  },

  // BK/DIONE
  {
    localDir: 'BK DIONE',
    fileIndex: 0, // 17.43.39 — BK departure from Dione
    r2Key: 'evidence/bk/bk_dione_departure.png',
    dossier: 'bk', relationType: 'case', relationKey: 'BOTIFY-MAIN',
    snapshotType: 'tweet_post',
    title: 'BK Steps Back from @DioneProtocol — March 2025',
    caption: "BK posts 'After dedicating my time towards @DioneProtocol since August 2022, I'm stepping back' — departure coincides with BOTIFY investigation period.",
    sourceLabel: 'X / @kokoski — Mar 19 2025',
    observedAt: '2025-03-19', displayOrder: 4,
  },
  {
    localDir: 'BK DIONE',
    fileIndex: 4, // 17.44.03 — BK reply to gordongekko
    r2Key: 'evidence/bk/bk_gordongekko_reply.png',
    dossier: 'bk', relationType: 'case', relationKey: 'BOTIFY-MAIN',
    snapshotType: 'tweet_post',
    title: 'BK Replies to @GordonGekko — $DIONE $OVPP Promotion',
    caption: "BK replies to @GordonGekko promoting $DIONE and $OVPP — documents coordination between the two actors.",
    sourceLabel: 'X / @kokoski — Sep 28 2025',
    observedAt: '2025-09-28', displayOrder: 5,
  },
]

async function main() {
  console.log('\n=== OSINT EVIDENCE UPLOAD ===\n')

  const manifest: Array<{ dossier: string; r2Key: string; publicUrl: string | null; status: string }> = []

  for (const m of UPLOAD_MAP) {
    const dirPath = path.join(CASES_DIR, m.localDir)

    // List files sorted by name
    let files: string[]
    try {
      files = fs.readdirSync(dirPath)
        .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
        .sort()
    } catch (e) {
      console.log(`  ! dir not found: ${m.localDir}`)
      manifest.push({ dossier: m.dossier, r2Key: m.r2Key, publicUrl: null, status: 'dir_missing' })
      continue
    }

    if (m.fileIndex >= files.length) {
      console.log(`  ! file index ${m.fileIndex} out of range (${files.length} files) in ${m.localDir}`)
      manifest.push({ dossier: m.dossier, r2Key: m.r2Key, publicUrl: null, status: 'index_oob' })
      continue
    }

    const fileName = files[m.fileIndex]
    const filePath = path.join(dirPath, fileName)

    // Check if already in R2
    const exists = await r2Exists(m.r2Key)
    if (exists) {
      const url = `${R2_PUBLIC_BASE}/${m.r2Key}`
      console.log(`  = ${m.r2Key} (already exists)`)
      manifest.push({ dossier: m.dossier, r2Key: m.r2Key, publicUrl: url, status: 'exists' })
    } else {
      try {
        const body = fs.readFileSync(filePath)
        const url = await r2Upload(m.r2Key, body, 'image/png')
        console.log(`  + ${m.r2Key} (${(body.length / 1024).toFixed(0)} KB)`)
        manifest.push({ dossier: m.dossier, r2Key: m.r2Key, publicUrl: url, status: 'uploaded' })
      } catch (e: any) {
        console.log(`  ! upload failed: ${m.r2Key} — ${e.message?.slice(0, 80)}`)
        manifest.push({ dossier: m.dossier, r2Key: m.r2Key, publicUrl: null, status: 'upload_failed' })
      }
    }
  }

  // Upsert EvidenceSnapshot records
  console.log('\n--- Upserting snapshot records ---\n')

  for (const m of UPLOAD_MAP) {
    const entry = manifest.find(e => e.r2Key === m.r2Key)
    const imageUrl = entry?.publicUrl ?? null

    const existing = await prisma.evidenceSnapshot.findFirst({
      where: { relationType: m.relationType, relationKey: m.relationKey, title: m.title },
    })

    if (existing) {
      if (imageUrl && !existing.imageUrl) {
        await prisma.evidenceSnapshot.update({ where: { id: existing.id }, data: { imageUrl } })
        console.log(`  ~ updated imageUrl: ${m.title.slice(0, 50)}...`)
      } else {
        console.log(`  = exists: ${m.title.slice(0, 50)}...`)
      }
    } else {
      await prisma.evidenceSnapshot.create({
        data: {
          relationType: m.relationType,
          relationKey: m.relationKey,
          snapshotType: m.snapshotType,
          imageUrl,
          title: m.title,
          caption: m.caption,
          sourceLabel: m.sourceLabel,
          observedAt: m.observedAt ? new Date(m.observedAt) : null,
          displayOrder: m.displayOrder,
          isPublic: true,
          reviewStatus: 'approved',
        },
      })
      console.log(`  + created: ${m.title.slice(0, 50)}...`)
    }
  }

  console.log('\n--- MANIFEST ---')
  console.log(JSON.stringify(manifest, null, 2))
  console.log('\n=== DONE ===\n')

  await prisma.$disconnect()
}

main()
