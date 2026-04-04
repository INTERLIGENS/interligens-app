import { prisma } from '@/lib/prisma'
import { PUBLIC_KOL_FILTER } from './publishGate'
import { parseBehaviorFlags } from './behaviorFlags'

export type LeaderboardSort = 'proceeds' | 'evidence' | 'completeness' | 'flags' | 'recent'

export interface LeaderboardFilters {
  sort?: LeaderboardSort
  filterDepth?: string
  filterCompleteness?: string
  filterHasProceeds?: boolean
  filterHasFlags?: boolean
  search?: string
}

const SORT_MAP: Record<LeaderboardSort, object> = {
  proceeds:     { totalDocumented: 'desc' },
  evidence:     { evidenceDepth: 'desc' },
  completeness: { completenessLevel: 'desc' },
  flags:        { behaviorFlags: 'desc' },
  recent:       { updatedAt: 'desc' },
}

export async function getLeaderboardProfiles(filters: LeaderboardFilters = {}) {
  const {
    sort = 'proceeds',
    filterDepth,
    filterCompleteness,
    filterHasProceeds,
    filterHasFlags,
    search,
  } = filters

  const where: any = {
    ...PUBLIC_KOL_FILTER,
    ...(filterDepth ? { evidenceDepth: filterDepth } : {}),
    ...(filterCompleteness ? { completenessLevel: filterCompleteness } : {}),
    ...(filterHasProceeds ? { totalDocumented: { gt: 0 } } : {}),
    ...(search ? { handle: { contains: search, mode: 'insensitive' } } : {}),
  }

  const profiles = await prisma.kolProfile.findMany({
    where,
    orderBy: SORT_MAP[sort] ?? SORT_MAP.proceeds,
    select: {
      handle: true,
      displayName: true,
      tier: true,
      summary: true,
      totalDocumented: true,
      proceedsCoverage: true,
      evidenceDepth: true,
      completenessLevel: true,
      walletAttributionStrength: true,
      behaviorFlags: true,
      lastEnrichedAt: true,
      updatedAt: true,
      verified: true,
      _count: {
        select: {
          evidences: true,
          tokenLinks: true,
          kolWallets: true,
          laundryTrails: true,
        },
      },
    },
  })

  const results = profiles.map((p) => {
    const flagsParsed = parseBehaviorFlags(p.behaviorFlags)
    return {
      handle: p.handle,
      displayName: p.displayName,
      tier: p.tier,
      summary: p.summary,
      observedProceedsTotal: p.totalDocumented ?? null,
      proceedsCoverage: p.proceedsCoverage,
      evidenceDepth: p.evidenceDepth,
      completenessLevel: p.completenessLevel,
      walletAttributionStrength: p.walletAttributionStrength,
      behaviorFlags: flagsParsed,
      behaviorFlagsCount: flagsParsed.length,
      evidenceCount: p._count.evidences,
      linkedTokensCount: p._count.tokenLinks,
      documentedWalletsCount: p._count.kolWallets,
      hasLaundryTrail: p._count.laundryTrails > 0,
      lastEnrichedAt: p.lastEnrichedAt,
      updatedAt: p.updatedAt,
      verified: p.verified,
    }
  })

  if (filterHasFlags) {
    return results.filter((r) => r.behaviorFlagsCount > 0)
  }

  return results
}

export async function getLeaderboardStats() {
  const where = { ...PUBLIC_KOL_FILTER }

  const [
    publishedCount,
    proceedsAgg,
    walletsCount,
    tokensCount,
    profilesWithProceeds,
    profilesWithStrongEvidence,
  ] = await Promise.all([
    prisma.kolProfile.count({ where }),
    prisma.kolProfile.aggregate({
      where: { ...where, totalDocumented: { not: null, gt: 0 } },
      _sum: { totalDocumented: true },
    }),
    prisma.kolWallet.count({
      where: { kol: where },
    }),
    prisma.kolTokenLink.findMany({ where: { kol: where }, select: { tokenSymbol: true }, distinct: ['tokenSymbol'] }).then(r => r.length),
    prisma.kolProfile.count({
      where: { ...where, totalDocumented: { not: null, gt: 0 } },
    }),
    prisma.kolProfile.count({
      where: { ...where, evidenceDepth: { in: ['strong', 'comprehensive'] } },
    }),
  ])

  return {
    publishedCount,
    totalObservedProceeds: proceedsAgg._sum.totalDocumented ?? 0,
    totalDocumentedWallets: walletsCount,
    totalLinkedTokens: tokensCount,
    profilesWithProceeds,
    profilesWithStrongEvidence,
  }
}
