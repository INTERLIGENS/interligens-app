import type { ScanGroundingContext } from './groundingContext'
import { getClusterContextForLaunch } from '@/lib/cluster/clusterRisk'
import { getCoordinationSignalsForLaunch } from '@/lib/coordination'

export function generateWhyBullets(ctx: ScanGroundingContext): string[] {
  const bullets: string[] = []
  const used = new Set<string>()
  const fr = ctx.locale === 'fr'

  function add(key: string, en: string, frText: string) {
    if (bullets.length >= 5 || used.has(key)) return
    used.add(key)
    bullets.push(fr ? frText : en)
  }

  // 1. Related actors across multiple launches
  if (ctx.relatedActorsCount >= 2 && ctx.relatedLaunches.length >= 2) {
    const handles = ctx.relatedLaunches.slice(0, 3).join(', ')
    add('related_actors',
      `Related actors documented across ${ctx.relatedLaunches.length} launches (${handles})`,
      `Acteurs lies documentes sur ${ctx.relatedLaunches.length} lancements (${handles})`)
  }

  // 2. Coordinated promotion
  const coordSignal = ctx.coordinationSignals.find(s => s.type === 'coordinated_promotion')
  if (coordSignal) {
    add('coordinated_promotion',
      `Coordinated promotion documented with ${ctx.relatedActorsCount} linked actors`,
      `Promotion coordonnee documentee avec ${ctx.relatedActorsCount} acteurs lies`)
  }

  // 3. Repeated cashout with proceeds
  const cashoutSignal = ctx.coordinationSignals.find(s => s.type === 'repeated_cashout')
  if (cashoutSignal && ctx.proceedsSummary) {
    add('repeated_cashout',
      `Repeated cashout pattern — ${ctx.proceedsSummary}`,
      `Schema de cashout repete — ${ctx.proceedsSummary}`)
  }

  // 4. Laundry trail
  if (ctx.hasLaundryTrail) {
    add('laundry_trail',
      'Multi-hop fund movement patterns observed',
      'Mouvements de fonds multi-sauts observes')
  }

  // 5. Cross-case recurrence
  if (ctx.relatedCases.length >= 2) {
    add('cross_case',
      `Cross-case recurrence across ${ctx.relatedCases.length} documented cases`,
      `Recurrence multi-dossiers sur ${ctx.relatedCases.length} cas documentes`)
  }

  // 6. Known linked wallets
  if (ctx.walletAttributionStrength === 'high' || ctx.walletAttributionStrength === 'confirmed') {
    add('linked_wallets',
      'Known linked wallets documented',
      'Wallets lies documentes')
  }

  // 7. Proceeds summary (if not already used via cashout)
  if (ctx.proceedsSummary) {
    add('proceeds',
      ctx.proceedsSummary,
      ctx.proceedsSummary)
  }

  // 8. Fallback: top risk driver
  if (ctx.topRiskDrivers.length > 0) {
    add('risk_driver', ctx.topRiskDrivers[0], ctx.topRiskDrivers[0])
  }

  return bullets
}

export async function generateWhyBulletsForLaunch(
  tokenSymbol: string,
  locale: 'en' | 'fr' = 'en',
): Promise<string[]> {
  const [cluster, coordination] = await Promise.all([
    getClusterContextForLaunch(tokenSymbol),
    getCoordinationSignalsForLaunch(tokenSymbol),
  ])

  const bullets: string[] = []
  const fr = locale === 'fr'

  if (cluster.linkedActors.length >= 2) {
    const handles = cluster.linkedActors.slice(0, 3).map(a => '@' + a.handle).join(', ')
    bullets.push(fr
      ? `${cluster.linkedActors.length} acteurs lies a ${tokenSymbol} (${handles})`
      : `${cluster.linkedActors.length} actors linked to ${tokenSymbol} (${handles})`)
  }

  const coordSignal = coordination.signals.find(s => s.type === 'coordinated_promotion')
  if (coordSignal) {
    bullets.push(fr ? coordSignal.labelFr : coordSignal.labelEn)
  }

  if (cluster.linkedCasesCount >= 2) {
    bullets.push(fr
      ? `Recurrence sur ${cluster.linkedCasesCount} cas documentes`
      : `Recurrence across ${cluster.linkedCasesCount} documented cases`)
  }

  if (cluster.sharedPatterns.length > 0) {
    const top = cluster.sharedPatterns[0]
    const flagLabels: Record<string, { en: string; fr: string }> = {
      REPEATED_CASHOUT: { en: 'Repeated cashout pattern', fr: 'Schema de cashout repete' },
      COORDINATED_PROMOTION: { en: 'Coordinated promotion', fr: 'Promotion coordonnee' },
      KNOWN_LINKED_WALLETS: { en: 'Known linked wallets', fr: 'Wallets lies documentes' },
    }
    const label = flagLabels[top]
    if (label && bullets.length < 5) bullets.push(fr ? label.fr : label.en)
  }

  return bullets.slice(0, 5)
}
