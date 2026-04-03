import fs from 'fs'
const envLocal = fs.readFileSync('.env.local','utf8')
const dbUrl = envLocal.match(/DATABASE_URL="([^"]+)"/)?.[1]
if (dbUrl) process.env.DATABASE_URL = dbUrl

// scripts/seed/engine.ts
// KOL Seed Engine — INTERLIGENS
// Adapté au schema réel : KolEvidence existant, KolAlias/KolTokenLink nouveaux
// Idempotent | No auto-publish | Dedup strict

import { PrismaClient } from '@prisma/client'
import type { SeedKolProfile } from './types'

const prisma = new PrismaClient()

// ─── Counters ──────────────────────────────────────────────────────────────

interface SeedStats {
  profiles:   { created: number; enriched: number; skipped: number }
  aliases:    { created: number; skipped: number }
  wallets:    { created: number; skipped: number }
  evidences:  { created: number; skipped: number }
  tokenLinks: { created: number; skipped: number }
}

function emptyStats(): SeedStats {
  return {
    profiles:   { created: 0, enriched: 0, skipped: 0 },
    aliases:    { created: 0, skipped: 0 },
    wallets:    { created: 0, skipped: 0 },
    evidences:  { created: 0, skipped: 0 },
    tokenLinks: { created: 0, skipped: 0 },
  }
}

// ─── Hiérarchies de statuts ────────────────────────────────────────────────

const STATUS_HIERARCHY = ['none', 'weak', 'partial', 'moderate', 'strong', 'confirmed', 'verified']
const CONF_HIERARCHY   = ['suspected', 'low', 'medium', 'high', 'confirmed']

function shouldUpgrade(current: string | null, proposed: string | undefined, hierarchy: string[]): boolean {
  if (!proposed || current === null) return false
  return hierarchy.indexOf(proposed) > hierarchy.indexOf(current ?? 'none')
}

// ─── Upsert profil ─────────────────────────────────────────────────────────

async function upsertProfile(data: SeedKolProfile, stats: SeedStats): Promise<void> {
  const handle = data.handle.replace(/^@/, '')

  // Garde-fou : jamais auto-publish depuis le seed
  const requestedStatus = data.publishStatus ?? 'draft'
  const safeStatus = requestedStatus === 'published' ? 'reviewed' : requestedStatus
  if (requestedStatus === 'published') {
    console.warn(`  ⚠️  [${handle}] 'published' bloqué en seed → forcé 'reviewed'`)
  }

  const existing = await prisma.kolProfile.findUnique({ where: { handle } })

  if (!existing) {
    await prisma.kolProfile.create({
      data: {
        handle,
        displayName:            data.displayName ?? handle,
        platform:               data.platform ?? 'x',
        bio:                    data.bio,
        tier:                   data.tier,
        verified:               data.verified ?? false,
        publishable:            false,       // jamais true depuis seed
        publishStatus:          safeStatus,
        internalNote:           data.internalNote,
        walletAttributionStatus: data.walletAttributionStatus ?? 'none',
        evidenceStatus:         data.evidenceStatus ?? 'none',
        proceedsStatus:         data.proceedsStatus ?? 'none',
        editorialStatus:        data.editorialStatus ?? 'pending',
      },
    })
    console.log(`  ✅ [${handle}] créé (status: ${safeStatus})`)
    stats.profiles.created++
  } else {
    // Enrichissement intelligent — ne remplace que les champs vides
    const updates: Record<string, unknown> = {}

    if (!existing.displayName && data.displayName)   updates.displayName   = data.displayName
    if (!existing.bio         && data.bio)            updates.bio           = data.bio
    if (!existing.tier        && data.tier)           updates.tier          = data.tier
    if (!existing.internalNote && data.internalNote)  updates.internalNote  = data.internalNote

    // Upgrade sous-statuts si meilleur
    if (shouldUpgrade(existing.walletAttributionStatus, data.walletAttributionStatus, STATUS_HIERARCHY))
      updates.walletAttributionStatus = data.walletAttributionStatus
    if (shouldUpgrade(existing.evidenceStatus, data.evidenceStatus, STATUS_HIERARCHY))
      updates.evidenceStatus = data.evidenceStatus
    if (shouldUpgrade(existing.proceedsStatus, data.proceedsStatus, STATUS_HIERARCHY))
      updates.proceedsStatus = data.proceedsStatus

    if (Object.keys(updates).length > 0) {
      await prisma.kolProfile.update({ where: { handle }, data: updates })
      console.log(`  🔄 [${handle}] enrichi → ${Object.keys(updates).join(', ')}`)
      stats.profiles.enriched++
    } else {
      console.log(`  — [${handle}] déjà à jour`)
      stats.profiles.skipped++
    }
  }

  // Sous-entités
  if (data.aliases?.length)    await upsertAliases(handle, data.aliases, stats)
  if (data.wallets?.length)    await upsertWallets(handle, data.wallets, stats)
  if (data.evidences?.length)  await upsertEvidences(handle, data.evidences, stats)
  if (data.tokenLinks?.length) await upsertTokenLinks(handle, data.tokenLinks, stats)
}

// ─── Aliases ───────────────────────────────────────────────────────────────

async function upsertAliases(kolHandle: string, aliases: NonNullable<SeedKolProfile['aliases']>, stats: SeedStats) {
  for (const a of aliases) {
    const alias = a.alias.replace(/^@/, '').toLowerCase()
    try {
      await prisma.kolAlias.create({ data: { kolHandle, alias, type: a.type } })
      console.log(`    + alias [${alias}] (${a.type})`)
      stats.aliases.created++
    } catch {
      stats.aliases.skipped++  // unique constraint = déjà existant
    }
  }
}

// ─── Wallets ───────────────────────────────────────────────────────────────

async function upsertWallets(kolHandle: string, wallets: NonNullable<SeedKolProfile['wallets']>, stats: SeedStats) {
  for (const w of wallets) {
    const address = w.address.trim()

    // Cherche par adresse (un wallet ne doit appartenir qu'à un seul acteur)
    const existing = await prisma.kolWallet.findFirst({
      where: { address, chain: w.chain },
    })

    if (!existing) {
      await prisma.kolWallet.create({
        data: {
          kolHandle,
          address,
          chain:             w.chain,
          label:             w.label,
          confidence:        w.confidence,
          attributionSource: w.attributionSource,
          attributionNote:   w.attributionNote,
        },
      })
      console.log(`    + wallet [${w.chain}:${address.slice(0, 10)}...] (${w.confidence})`)
      stats.wallets.created++
    } else {
      // Upgrade confidence si meilleure qualité
      if (shouldUpgrade(existing.confidence, w.confidence, CONF_HIERARCHY)) {
        await prisma.kolWallet.update({
          where: { id: existing.id },
          data: {
            confidence:        w.confidence,
            attributionSource: w.attributionSource,
            attributionNote:   w.attributionNote,
          },
        })
        console.log(`    ↑ wallet [${address.slice(0, 10)}...] confidence: ${existing.confidence} → ${w.confidence}`)
      }
      stats.wallets.skipped++
    }
  }
}

// ─── Evidences — adapté au schema KolEvidence existant ────────────────────
// Champs existants utilisés : type=sourceType, label=title, description=excerpt,
// dateFirst=observedAt, sourceUrl, dedupKey (nouveau champ ajouté)

async function upsertEvidences(kolHandle: string, evidences: NonNullable<SeedKolProfile['evidences']>, stats: SeedStats) {
  for (const e of evidences) {
    // Dedup par (kolHandle, dedupKey)
    const existing = await prisma.kolEvidence.findFirst({
      where: { kolHandle, dedupKey: e.dedupKey },
    })

    if (!existing) {
      await prisma.kolEvidence.create({
        data: {
          kolHandle,
          type:      e.sourceType,           // champ existant
          label:     e.title,                // champ existant
          description: e.excerpt ?? null,    // champ existant
          sourceUrl:  e.sourceUrl ?? null,   // champ existant
          dateFirst:  e.observedAt ? new Date(e.observedAt) : null,  // champ existant
          dedupKey:   e.dedupKey,            // nouveau champ
          wallets:    '[]',                  // champ existant requis
        },
      })
      console.log(`    + evidence [${e.dedupKey}]`)
      stats.evidences.created++
    } else {
      stats.evidences.skipped++
    }
  }
}

// ─── Token Links ───────────────────────────────────────────────────────────

async function upsertTokenLinks(kolHandle: string, tokenLinks: NonNullable<SeedKolProfile['tokenLinks']>, stats: SeedStats) {
  for (const t of tokenLinks) {
    try {
      await prisma.kolTokenLink.create({
        data: {
          kolHandle,
          contractAddress: t.contractAddress,
          chain:           t.chain,
          tokenSymbol:     t.tokenSymbol,
          role:            t.role,
          note:            t.note,
        },
      })
      console.log(`    + token [${t.tokenSymbol ?? t.contractAddress.slice(0, 10)}] (${t.role})`)
      stats.tokenLinks.created++
    } catch {
      stats.tokenLinks.skipped++  // unique constraint = déjà existant
    }
  }
}

// ─── Runner ────────────────────────────────────────────────────────────────

export async function runSeedBatch(profiles: SeedKolProfile[]): Promise<void> {
  const stats = emptyStats()

  console.log(`\n🌱 INTERLIGENS — KOL SEED ENGINE`)
  console.log(`   ${profiles.length} profils à traiter\n`)

  for (const profile of profiles) {
    console.log(`\n► ${profile.handle}`)
    try {
      await upsertProfile(profile, stats)
    } catch (err) {
      console.error(`  ❌ Erreur [${profile.handle}]:`, err)
    }
  }

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`✅ SEED TERMINÉ`)
  console.log(`   Profils   : +${stats.profiles.created} créés | ~${stats.profiles.enriched} enrichis | ${stats.profiles.skipped} ignorés`)
  console.log(`   Aliases   : +${stats.aliases.created} | ${stats.aliases.skipped} ignorés`)
  console.log(`   Wallets   : +${stats.wallets.created} | ${stats.wallets.skipped} ignorés`)
  console.log(`   Evidences : +${stats.evidences.created} | ${stats.evidences.skipped} ignorées`)
  console.log(`   Tokens    : +${stats.tokenLinks.created} | ${stats.tokenLinks.skipped} ignorés`)
  console.log(`${'─'.repeat(50)}\n`)

  await prisma.$disconnect()
}
