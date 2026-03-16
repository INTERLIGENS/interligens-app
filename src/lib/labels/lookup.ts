import { prisma } from '@/lib/prisma'

export interface LabelResult {
  label: string
  category: string
  confidence: string
  source: string
  sourceUrl?: string | null
  verified: boolean
  notes?: string | null
}

export async function lookupAddress(address: string): Promise<LabelResult | null> {
  if (!address) return null
  const addr = address.toLowerCase()
  const exact = await prisma.walletLabel.findFirst({
    where: { address: addr, verified: true },
    orderBy: { confidence: 'asc' }
  })
  if (!exact) return null
  return { label: exact.label, category: exact.category, confidence: exact.confidence, source: exact.source, sourceUrl: exact.sourceUrl, verified: exact.verified, notes: exact.notes }
}

export async function lookupAddresses(addresses: string[]): Promise<Record<string, LabelResult>> {
  if (!addresses.length) return {}
  const addrs = addresses.map(a => a.toLowerCase())
  const labels = await prisma.walletLabel.findMany({ where: { address: { in: addrs }, verified: true } })
  const result: Record<string, LabelResult> = {}
  for (const l of labels) {
    if (!result[l.address]) {
      result[l.address] = { label: l.label, category: l.category, confidence: l.confidence, source: l.source, sourceUrl: l.sourceUrl, verified: l.verified, notes: l.notes }
    }
  }
  return result
}

export function categoryBadge(category: string): { color: string; emoji: string } {
  const map: Record<string, { color: string; emoji: string }> = {
    scammer: { color: '#ef4444', emoji: '🚨' },
    team:    { color: '#f97316', emoji: '👥' },
    kol:     { color: '#f59e0b', emoji: '📣' },
    cex:     { color: '#3b82f6', emoji: '🏦' },
    mixer:   { color: '#8b5cf6', emoji: '🌀' },
    victim:  { color: '#6b7280', emoji: '⚠️' },
    other:   { color: '#6b7280', emoji: '●' },
  }
  return map[category] ?? map.other
}
