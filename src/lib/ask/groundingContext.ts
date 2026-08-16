import { prisma } from '@/lib/prisma'
import { PUBLIC_KOL_FILTER } from '@/lib/kol/publishGate'
import { getRelatedActorsForProfile } from '@/lib/cluster/clusterRisk'
import { getCoordinationSignalsForProfile, type CoordinationSignal } from '@/lib/coordination'
import { redactProceeds } from '@/lib/kol/proceedsGate'

export interface ScanGroundingContext {
  handle: string
  tigerScore?: number
  topRiskDrivers: string[]
  clusterSummary?: string
  relatedActorsCount: number
  relatedLaunches: string[]
  relatedCases: string[]
  coordinationSignals: CoordinationSignal[]
  strongestCoordinationSignal?: CoordinationSignal
  proceedsSummary?: string
  proceedsCoverage?: string
  hasLaundryTrail: boolean
  laundryRisk?: string
  walletAttributionStrength?: string
  evidenceDepth?: string
  linkedLaunchesCount: number
  linkedCasesCount: number
  dataCoverageSummary: string
  locale: 'en' | 'fr'
}

export async function buildGroundingContext(
  handle: string,
  locale: 'en' | 'fr' = 'en',
): Promise<ScanGroundingContext | null> {
  const profile = await prisma.kolProfile.findFirst({
    where: { handle: { equals: handle, mode: 'insensitive' }, ...PUBLIC_KOL_FILTER },
    select: {
      handle: true,
      totalDocumented: true,
      // P0 containment — sans cette selection, redactProceeds fail-close et le
      // montant ne part pas dans le prompt. C'est le comportement voulu.
      proceedsPublication: true,
      proceedsCoverage: true,
      walletAttributionStrength: true,
      evidenceDepth: true,
      completenessLevel: true,
      laundryTrails: { select: { laundryRisk: true }, take: 1 },
      _count: { select: { kolWallets: true, kolCases: true, tokenLinks: true } },
    },
  })

  if (!profile) return null

  const [cluster, coordination] = await Promise.all([
    getRelatedActorsForProfile(handle),
    getCoordinationSignalsForProfile(handle),
  ])

  const hasLaundryTrail = profile.laundryTrails.length > 0
  const laundryRisk = hasLaundryTrail ? String(profile.laundryTrails[0].laundryRisk) : undefined

  // Build proceeds summary
  //
  // P0 containment — c'est la surface la plus difficile a rattraper apres coup :
  // le montant ne part pas dans un champ JSON mais dans un PROMPT, et ressort
  // en prose librement reformulee par le modele (« Min. $580K observed »).
  // Aucun filtre applique en aval de la generation ne peut le rattraper : il
  // faut qu'il n'entre jamais dans le contexte.
  const publishedProceeds = redactProceeds(profile, profile.totalDocumented)
  let proceedsSummary: string | undefined
  if (publishedProceeds != null && publishedProceeds > 0) {
    const amt = publishedProceeds >= 1000
      ? '$' + (publishedProceeds / 1000).toFixed(0) + 'K'
      : '$' + publishedProceeds.toLocaleString('en-US')
    if (profile.proceedsCoverage === 'partial' || profile.proceedsCoverage === 'estimated') {
      proceedsSummary = locale === 'fr'
        ? `Min. ${amt} observe — couverture partielle`
        : `Min. ${amt} observed — partial coverage`
    } else if (profile.proceedsCoverage === 'verified') {
      proceedsSummary = `${amt} ${locale === 'fr' ? 'verifie' : 'verified'}`
    } else {
      proceedsSummary = amt
    }
  }

  // Data coverage summary
  const gaps: string[] = []
  if (profile.completenessLevel === 'incomplete' || profile.completenessLevel === 'partial') {
    gaps.push(locale === 'fr' ? 'profil incomplet' : 'profile incomplete')
  }
  if (profile.walletAttributionStrength === 'none' || profile.walletAttributionStrength === 'low') {
    gaps.push(locale === 'fr' ? 'attribution wallets faible' : 'wallet attribution weak')
  }
  const dataCoverageSummary = gaps.length > 0
    ? (locale === 'fr' ? 'Partiel — ' : 'Partial — ') + gaps.join(', ')
    : (locale === 'fr' ? 'Couverture substantielle' : 'Substantial coverage')

  // Top 3 coordination signals
  const top3 = coordination.signals.slice(0, 3)

  return {
    handle: profile.handle,
    topRiskDrivers: [],
    clusterSummary: cluster?.overlapSummary ?? undefined,
    relatedActorsCount: cluster?.relatedActors.length ?? 0,
    relatedLaunches: cluster?.relatedLaunches ?? [],
    relatedCases: cluster?.relatedCases ?? [],
    coordinationSignals: top3,
    strongestCoordinationSignal: coordination.strongestSignal ?? undefined,
    proceedsSummary,
    proceedsCoverage: profile.proceedsCoverage ?? undefined,
    hasLaundryTrail,
    laundryRisk,
    walletAttributionStrength: profile.walletAttributionStrength ?? undefined,
    evidenceDepth: profile.evidenceDepth ?? undefined,
    linkedLaunchesCount: cluster?.relatedLaunches.length ?? 0,
    linkedCasesCount: cluster?.relatedCases.length ?? 0,
    dataCoverageSummary,
    locale,
  }
}
