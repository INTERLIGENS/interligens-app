// INTERLIGENS — Scan enrichment with WalletLabel
// Called at scan time to check if scanned address is known

import { prisma } from '@/lib/prisma'
import { decorate, assertDtoPublishable, type NatureEnvelope } from '@/lib/data-nature/dto'

export interface ScanLabelResult {
  found: boolean
  label?: string
  category?: string
  confidence?: string
  source?: string
  notes?: string
  badgeColor?: string
  badgeText?: string
  /**
   * S2 — la nature voyage avec la donnée jusqu'à la sortie publique.
   * `/api/scan/label` renvoie cet objet tel quel : la surface est donc couverte
   * sans toucher au chemin gelé `src/app/api/`.
   *
   * Additif : `_nature` n'existait pas, aucun champ existant ne change. Absent
   * quand `found: false` — il n'y a alors aucune affirmation à qualifier.
   */
  _nature?: NatureEnvelope
}

const CATEGORY_BADGE: Record<string, { color: string; text: string }> = {
  scammer: { color: '#ef4444', text: 'DOCUMENTED CRITICAL RISK ACTOR' },
  team:    { color: '#f97316', text: 'TEAM WALLET' },
  kol:     { color: '#f59e0b', text: 'PAID PROMOTER' },
  cex:     { color: '#3b82f6', text: 'CEX WALLET' },
  mixer:   { color: '#8b5cf6', text: 'MIXER' },
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

    // Q2 — `confidence` est renvoyée telle quelle, mais elle n'est désormais
    // lisible qu'AVEC la nature à côté : un 'HIGH' de documentation publique et
    // un 'HIGH' que nous affirmerions nous-mêmes ne mesurent pas la même chose.
    const dto = decorate(
      'WalletLabel',
      {
        found: true as const,
        label: label.label,
        category: label.category,
        confidence: label.confidence,
        source: label.source,
        notes: label.notes ?? undefined,
        badgeColor: badge.color,
        badgeText: badge.text,
      },
      'checkAddressLabel',
    )
    // S6-2 — CHOKEPOINT de publication. `decorate` pose l'enveloppe ; c'est ici
    // qu'on refuse de la SORTIR si elle n'est pas publiable : UNCLASSIFIED, ou
    // ESTIMATE sans méthode auditable. Sans cet appel, l'enveloppe était
    // décorative — le module d'enforcement existait sans être branché.
    assertDtoPublishable(dto, 'checkAddressLabel')
    return dto
  } catch {
    return { found: false }
  }
}
