import { prisma } from '@/lib/prisma'
import { PUBLIC_KOL_FILTER } from '@/lib/kol/publishGate'
import { parseBehaviorFlags, type BehaviorFlagKey } from '@/lib/kol/behaviorFlags'

export type DossierKind = 'case' | 'launch'

export interface LinkedActor {
  handle: string
  displayName: string | null
  role: string
  tier: string | null
}

export interface DossierItem {
  id: string
  kind: DossierKind
  title: string
  summary: string | null
  primaryDate: string
  linkedActors: LinkedActor[]
  linkedActorsCount: number
  proceedsObservedTotal: number | null
  proceedsCoverage: string
  evidenceDepth: string
  strongestFlags: string[]
  documentationStatus: string
  href: string
}

export interface ExplorerFilters {
  kind?: DossierKind
  search?: string
  hasProceeds?: boolean
  hasFlags?: boolean
}

// Published handle set — used to filter actors
async function getPublishedHandles(): Promise<Map<string, { displayName: string | null; tier: string | null; evidenceDepth: string; behaviorFlags: string; totalDocumented: number | null }>> {
  const profiles = await prisma.kolProfile.findMany({
    where: PUBLIC_KOL_FILTER,
    select: { handle: true, displayName: true, tier: true, evidenceDepth: true, behaviorFlags: true, totalDocumented: true },
  })
  return new Map(profiles.map(p => [p.handle, p]))
}

const DEPTH_ORDER: Record<string, number> = { none: 0, weak: 1, moderate: 2, strong: 3, comprehensive: 4 }
const DEPTH_REVERSE: string[] = ['none', 'weak', 'moderate', 'strong', 'comprehensive']

function strongestDepth(depths: string[]): string {
  let best = 0
  for (const d of depths) best = Math.max(best, DEPTH_ORDER[d] ?? 0)
  return DEPTH_REVERSE[best] ?? 'none'
}

export async function getCaseDossiers(published: Map<string, { displayName: string | null; tier: string | null; evidenceDepth: string; behaviorFlags: string; totalDocumented: number | null }>): Promise<DossierItem[]> {
  const cases = await prisma.kolCase.findMany({
    select: { id: true, caseId: true, kolHandle: true, role: true, paidUsd: true, evidence: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  // Group by caseId
  const grouped = new Map<string, typeof cases>()
  for (const c of cases) {
    const arr = grouped.get(c.caseId) || []
    arr.push(c)
    grouped.set(c.caseId, arr)
  }

  const dossiers: DossierItem[] = []

  for (const [caseId, entries] of grouped) {
    // Only include actors from published profiles
    const actors: LinkedActor[] = []
    const depths: string[] = []
    const allFlags: Set<string> = new Set()
    const evidenceSnippets: string[] = []
    // Use on-chain totalDocumented from profiles, not analytical paidUsd
    const seenHandles = new Set<string>()
    let totalProceeds = 0
    let hasProceeds = false

    for (const e of entries) {
      const profile = published.get(e.kolHandle)
      if (!profile) continue // skip unpublished

      actors.push({
        handle: e.kolHandle,
        displayName: profile.displayName,
        role: e.role,
        tier: profile.tier,
      })
      depths.push(profile.evidenceDepth)
      for (const f of parseBehaviorFlags(profile.behaviorFlags)) allFlags.add(f)
      if (e.evidence) evidenceSnippets.push(e.evidence)

      // Sum totalDocumented per unique handle (avoid double-counting)
      if (!seenHandles.has(e.kolHandle) && profile.totalDocumented != null && profile.totalDocumented > 0) {
        totalProceeds += profile.totalDocumented
        hasProceeds = true
        seenHandles.add(e.kolHandle)
      }
    }

    // Skip dossiers with zero published actors
    if (actors.length === 0) continue

    const bestDepth = strongestDepth(depths)
    const docStatus = (DEPTH_ORDER[bestDepth] ?? 0) >= 3 ? 'documented' : 'partial'

    dossiers.push({
      id: `case-${caseId}`,
      kind: 'case',
      title: caseId,
      summary: evidenceSnippets.length > 0
        ? evidenceSnippets.slice(0, 2).join(' | ')
        : null,
      primaryDate: entries[0].createdAt.toISOString(),
      linkedActors: actors,
      linkedActorsCount: actors.length,
      proceedsObservedTotal: hasProceeds ? totalProceeds : null,
      proceedsCoverage: 'partial',
      evidenceDepth: bestDepth,
      strongestFlags: [...allFlags].slice(0, 5),
      documentationStatus: docStatus,
      href: `/en/kol/${actors[0].handle}`,
    })
  }

  return dossiers
}

export async function getLaunchDossiers(published: Map<string, { displayName: string | null; tier: string | null; evidenceDepth: string; behaviorFlags: string; totalDocumented: number | null }>): Promise<DossierItem[]> {
  const tokens = await prisma.kolTokenLink.findMany({
    select: { id: true, tokenSymbol: true, contractAddress: true, chain: true, kolHandle: true, role: true, note: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  // Group by tokenSymbol ?? contractAddress
  const grouped = new Map<string, typeof tokens>()
  for (const t of tokens) {
    const key = t.tokenSymbol ?? t.contractAddress
    const arr = grouped.get(key) || []
    arr.push(t)
    grouped.set(key, arr)
  }

  const dossiers: DossierItem[] = []

  for (const [tokenKey, entries] of grouped) {
    const actors: LinkedActor[] = []
    const depths: string[] = []
    const allFlags: Set<string> = new Set()
    const notes: string[] = []

    for (const e of entries) {
      const profile = published.get(e.kolHandle)
      if (!profile) continue
      actors.push({ handle: e.kolHandle, displayName: profile.displayName, role: e.role, tier: profile.tier })
      depths.push(profile.evidenceDepth)
      for (const f of parseBehaviorFlags(profile.behaviorFlags)) allFlags.add(f)
      if (e.note) notes.push(e.note)
    }

    if (actors.length === 0) continue

    const chain = entries[0].chain
    const bestDepth = strongestDepth(depths)

    dossiers.push({
      id: `launch-${tokenKey}`,
      kind: 'launch',
      title: `${tokenKey} (${chain})`,
      summary: notes.length > 0 ? notes.slice(0, 2).join(' | ') : null,
      primaryDate: entries[0].createdAt.toISOString(),
      linkedActors: actors,
      linkedActorsCount: actors.length,
      proceedsObservedTotal: null,
      proceedsCoverage: 'none',
      evidenceDepth: bestDepth,
      strongestFlags: [...allFlags].slice(0, 5),
      documentationStatus: (DEPTH_ORDER[bestDepth] ?? 0) >= 3 ? 'documented' : 'partial',
      href: `/en/kol/${actors[0].handle}`,
    })
  }

  return dossiers
}

export async function getExplorerTimeline(filters: ExplorerFilters = {}) {
  const published = await getPublishedHandles()

  const [caseDossiers, launchDossiers] = await Promise.all([
    getCaseDossiers(published),
    getLaunchDossiers(published),
  ])

  let items = [...caseDossiers, ...launchDossiers]
  items.sort((a, b) => new Date(b.primaryDate).getTime() - new Date(a.primaryDate).getTime())

  // Apply filters
  if (filters.kind) items = items.filter(i => i.kind === filters.kind)
  if (filters.search) {
    const q = filters.search.toLowerCase()
    items = items.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.linkedActors.some(a => a.handle.toLowerCase().includes(q))
    )
  }
  if (filters.hasProceeds) items = items.filter(i => (i.proceedsObservedTotal ?? 0) > 0)
  if (filters.hasFlags) items = items.filter(i => i.strongestFlags.length > 0)

  return items
}

export async function getExplorerStats() {
  const where = { ...PUBLIC_KOL_FILTER }

  const [publishedProfiles, proceedsAgg, documentedWallets, linkedLaunches, strongEvidenceCount] = await Promise.all([
    prisma.kolProfile.count({ where }),
    prisma.kolProfile.aggregate({
      where: { ...where, totalDocumented: { not: null, gt: 0 } },
      _sum: { totalDocumented: true },
    }),
    prisma.kolWallet.count({ where: { isPubliclyUsable: true, kol: where } }),
    prisma.kolTokenLink.count({ where: { kol: where } }),
    prisma.kolProfile.count({ where: { ...where, evidenceDepth: { in: ['strong', 'comprehensive'] } } }),
  ])

  return {
    publishedProfiles,
    minimumObservedProceeds: proceedsAgg._sum.totalDocumented ?? 0,
    documentedWallets,
    linkedLaunches,
    strongEvidenceCount,
  }
}
