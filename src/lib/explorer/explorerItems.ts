import { prisma } from '@/lib/prisma'
import { PUBLIC_KOL_FILTER } from '@/lib/kol/publishGate'
import { parseBehaviorFlags, type BehaviorFlagKey } from '@/lib/kol/behaviorFlags'
import { getSnapshotCountByDossier } from '@/lib/evidence/evidenceSnapshots'

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
  sharedActorGroup: boolean
  multiLaunchRecurrence: boolean
  multiLaunchCount?: number
  topCoordinationSignal?: { labelEn: string; labelFr: string; strength: string } | null
  snapshotCount: number
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
      href: `/en/explorer/${caseId}`,
      sharedActorGroup: false,
      multiLaunchRecurrence: false,
      snapshotCount: 0,
    })
  }

  return dossiers
}

export async function getLaunchDossiers(published: Map<string, { displayName: string | null; tier: string | null; evidenceDepth: string; behaviorFlags: string; totalDocumented: number | null }>): Promise<DossierItem[]> {
  const tokens = await prisma.kolTokenLink.findMany({
    select: { id: true, tokenSymbol: true, contractAddress: true, chain: true, kolHandle: true, role: true, note: true, caseId: true, documentationStatus: true, createdAt: true },
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
    let bestDocStatus = 'partial'
    const DOC_ORDER: Record<string, number> = { partial: 0, documented: 1, confirmed: 2 }

    for (const e of entries) {
      // Skip review-status links from public display
      if (e.documentationStatus === 'review') continue
      const profile = published.get(e.kolHandle)
      if (!profile) continue
      actors.push({ handle: e.kolHandle, displayName: profile.displayName, role: e.role, tier: profile.tier })
      depths.push(profile.evidenceDepth)
      for (const f of parseBehaviorFlags(profile.behaviorFlags)) allFlags.add(f)
      if (e.note) notes.push(e.note)
      if ((DOC_ORDER[e.documentationStatus ?? 'partial'] ?? 0) > (DOC_ORDER[bestDocStatus] ?? 0)) {
        bestDocStatus = e.documentationStatus ?? 'partial'
      }
    }

    if (actors.length === 0) continue

    const chain = entries[0].chain
    const bestDepth = strongestDepth(depths)
    const caseId = entries.find(e => e.caseId)?.caseId ?? null

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
      documentationStatus: bestDocStatus,
      href: `/en/kol/${actors[0].handle}`,
      sharedActorGroup: false,
      multiLaunchRecurrence: false,
      snapshotCount: 0,
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

  // Cross-dossier analysis: detect shared actor groups across launches
  const launchActorSets = launchDossiers.map(d => new Set(d.linkedActors.map(a => a.handle)))
  for (let i = 0; i < launchDossiers.length; i++) {
    const actorsI = launchActorSets[i]
    let sharedCount = 0
    for (let j = 0; j < launchDossiers.length; j++) {
      if (i === j) continue
      const overlap = [...actorsI].filter(h => launchActorSets[j].has(h))
      if (overlap.length >= 2) sharedCount++
    }
    if (sharedCount > 0) {
      launchDossiers[i].sharedActorGroup = true
      launchDossiers[i].multiLaunchRecurrence = true
      launchDossiers[i].multiLaunchCount = sharedCount + 1
    }
  }
  // Same for case dossiers
  const caseActorSets = caseDossiers.map(d => new Set(d.linkedActors.map(a => a.handle)))
  for (let i = 0; i < caseDossiers.length; i++) {
    const actorsI = caseActorSets[i]
    let sharedCount = 0
    for (let j = 0; j < caseDossiers.length; j++) {
      if (i === j) continue
      const overlap = [...actorsI].filter(h => caseActorSets[j].has(h))
      if (overlap.length >= 2) sharedCount++
    }
    if (sharedCount > 0) {
      caseDossiers[i].sharedActorGroup = true
      caseDossiers[i].multiLaunchRecurrence = true
      caseDossiers[i].multiLaunchCount = sharedCount + 1
    }
  }

  // Enrich with snapshot counts
  const allRelationKeys = items.map(i => i.title)
  const snapCounts = await getSnapshotCountByDossier(allRelationKeys)
  for (const item of items) {
    item.snapshotCount = snapCounts.get(item.title) ?? 0
  }

  // Compute top coordination signal per dossier from available data (no extra DB calls)
  for (const item of items) {
    const actorCount = item.linkedActorsCount
    const hasCoordFlag = item.strongestFlags.includes('COORDINATED_PROMOTION')
    const hasMultiLaunch = item.multiLaunchRecurrence

    if (hasCoordFlag && actorCount >= 3) {
      item.topCoordinationSignal = { labelEn: 'Coordinated promotion', labelFr: 'Promotion coordonnee', strength: 'strong' }
    } else if (hasMultiLaunch && actorCount >= 2) {
      item.topCoordinationSignal = { labelEn: 'Shared actor group', labelFr: "Groupe d'acteurs commun", strength: 'strong' }
    } else if (hasCoordFlag) {
      item.topCoordinationSignal = { labelEn: 'Coordinated promotion', labelFr: 'Promotion coordonnee', strength: 'moderate' }
    } else {
      item.topCoordinationSignal = null
    }
  }

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
    prisma.kolTokenLink.findMany({ where: { kol: where }, select: { tokenSymbol: true }, distinct: ['tokenSymbol'] }).then(r => r.length),
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
