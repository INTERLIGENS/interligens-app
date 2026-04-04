import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface WalletAttributionInput {
  kolHandle: string
  chain: string
  address: string
  label?: string
  confidence: string
  attributionSource: string
  attributionNote: string
  isPubliclyUsable: boolean
  attributionStatus: string
  discoveredAt?: string
}

const CONF_HIERARCHY = ['suspected', 'low', 'medium', 'high', 'confirmed']

function shouldUpgrade(current: string, proposed: string): boolean {
  return CONF_HIERARCHY.indexOf(proposed) > CONF_HIERARCHY.indexOf(current)
}

export interface MergeStats {
  created: number
  upgraded: number
  skipped: number
}

export async function mergeWalletAttribution(
  input: WalletAttributionInput,
  stats: MergeStats,
): Promise<void> {
  const existing = await prisma.kolWallet.findFirst({
    where: { kolHandle: input.kolHandle, chain: input.chain, address: input.address },
  })

  if (!existing) {
    await prisma.kolWallet.create({
      data: {
        kolHandle: input.kolHandle,
        address: input.address,
        chain: input.chain,
        label: input.label,
        confidence: input.confidence,
        attributionSource: input.attributionSource,
        attributionNote: input.attributionNote,
        isPubliclyUsable: input.isPubliclyUsable,
        attributionStatus: input.attributionStatus,
        discoveredAt: input.discoveredAt ? new Date(input.discoveredAt) : null,
      },
    })
    console.log(`    + created [${input.chain}:${input.address.slice(0, 12)}...] (${input.confidence})`)
    stats.created++
    return
  }

  const updates: Record<string, unknown> = {}

  if (shouldUpgrade(existing.confidence, input.confidence)) {
    updates.confidence = input.confidence
  }

  // Upgrade attribution fields if provided and better
  if (input.attributionSource && !existing.attributionSource) {
    updates.attributionSource = input.attributionSource
  }
  if (input.attributionNote && !existing.attributionNote) {
    updates.attributionNote = input.attributionNote
  }
  if (input.label && (!existing.label || existing.label !== input.label)) {
    updates.label = input.label
  }

  // Upgrade status: review < confirmed < public
  const STATUS_HIERARCHY = ['review', 'confirmed', 'public']
  if (STATUS_HIERARCHY.indexOf(input.attributionStatus) > STATUS_HIERARCHY.indexOf(existing.attributionStatus ?? 'review')) {
    updates.attributionStatus = input.attributionStatus
  }

  // Only upgrade isPubliclyUsable to true, never downgrade
  if (input.isPubliclyUsable && !existing.isPubliclyUsable) {
    updates.isPubliclyUsable = true
  }

  if (input.discoveredAt && !existing.discoveredAt) {
    updates.discoveredAt = new Date(input.discoveredAt)
  }

  if (Object.keys(updates).length > 0) {
    await prisma.kolWallet.update({ where: { id: existing.id }, data: updates })
    console.log(`    ~ upgraded [${input.chain}:${input.address.slice(0, 12)}...] → ${Object.keys(updates).join(', ')}`)
    stats.upgraded++
  } else {
    console.log(`    = skipped [${input.chain}:${input.address.slice(0, 12)}...]`)
    stats.skipped++
  }
}

const STRENGTH_MAP: Record<string, string> = {
  confirmed: 'confirmed',
  high: 'high',
  medium: 'medium',
  low: 'low',
  suspected: 'none',
}

export async function syncKolWalletStrength(kolHandle: string): Promise<string> {
  const wallets = await prisma.kolWallet.findMany({
    where: { kolHandle },
    select: { confidence: true },
  })

  if (wallets.length === 0) {
    await prisma.kolProfile.update({
      where: { handle: kolHandle },
      data: { walletAttributionStrength: 'none' },
    })
    return 'none'
  }

  // Pick best confidence
  let best = 'suspected'
  for (const w of wallets) {
    if (CONF_HIERARCHY.indexOf(w.confidence) > CONF_HIERARCHY.indexOf(best)) {
      best = w.confidence
    }
  }

  const strength = STRENGTH_MAP[best] ?? 'none'
  await prisma.kolProfile.update({
    where: { handle: kolHandle },
    data: { walletAttributionStrength: strength },
  })
  console.log(`    → walletAttributionStrength=${strength} for ${kolHandle}`)
  return strength
}

export async function summarizeWalletCoverage(kolHandle: string) {
  const wallets = await prisma.kolWallet.findMany({
    where: { kolHandle },
    select: { confidence: true, attributionStatus: true, chain: true },
  })

  const chains = [...new Set(wallets.map(w => w.chain))]
  return {
    total: wallets.length,
    confirmed: wallets.filter(w => w.attributionStatus === 'confirmed' || w.attributionStatus === 'public').length,
    public: wallets.filter(w => w.attributionStatus === 'public').length,
    chains,
  }
}

export { prisma }
