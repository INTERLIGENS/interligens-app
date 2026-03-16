// INTERLIGENS — Scan enrichment with WalletLabel
// Called at scan time to check if scanned address is known

import { prisma } from '@/lib/prisma'

export interface ScanLabelResult {
  found: boolean
  label?: string
  category?: string
  confidence?: string
  source?: string
  notes?: string
  badgeColor?: string
  badgeText?: string
}

const CATEGORY_BADGE: Record<string, { color: string; text: string }> = {
  scammer: { color: '#ef4444', text: '🚨 KNOWN SCAMMER' },
  team:    { color: '#f97316', text: '⚠ TEAM WALLET' },
  kol:     { color: '#f59e0b', text: '📣 PAID PROMOTER' },
  cex:     { color: '#3b82f6', text: '🏦 CEX WALLET' },
  mixer:   { color: '#8b5cf6', text: '🌀 MIXER' },
  victim:  { color: '#6b7280', text: 'VICTIM WALLET' },
  other:   { color: '#6b7280', text: 'KNOWN WALLET' },
}

export async function checkAddressLabel(address: string): Promise<ScanLabelResult> {
  if (!address) return { found: false }

  try {
    const addr = address.toLowerCase().trim()
    const label = await prisma.walletLabel.findFirst({
      where: { address: addr, verified: true },
      orderBy: { confidence: 'asc' }
    })

    if (!label) return { found: false }

    const badge = CATEGORY_BADGE[label.category] ?? CATEGORY_BADGE.other

    return {
      found: true,
      label: label.label,
      category: label.category,
      confidence: label.confidence,
      source: label.source,
      notes: label.notes ?? undefined,
      badgeColor: badge.color,
      badgeText: badge.text,
    }
  } catch {
    return { found: false }
  }
}
