import { prisma } from '@/lib/prisma'
import { PUBLIC_KOL_FILTER } from '@/lib/kol/publishGate'
import { parseBehaviorFlags } from '@/lib/kol/behaviorFlags'

export interface ClusterSignal {
  type: 'shared_launch' | 'shared_case' | 'multi_launch_recurrence' | 'shared_actor_group' | 'repeated_pattern'
  label: string
  labelFr: string
  strength: 'weak' | 'moderate' | 'strong'
}

export interface RelatedActor {
  handle: string
  displayName: string | null
  tier: string | null
  roles: string[]
  sharedTokens: string[]
  sharedCases: string[]
}

export interface ClusterContext {
  relatedActors: RelatedActor[]
  relatedLaunches: string[]
  relatedCases: string[]
  clusterSignals: ClusterSignal[]
  overlapSummary: string
}

export interface LaunchClusterContext {
  linkedActors: RelatedActor[]
  linkedCasesCount: number
  sharedPatterns: string[]
  summary: string
}

export interface CaseClusterContext {
  linkedActors: RelatedActor[]
  linkedTokens: string[]
  sharedBehaviorFlags: string[]
  multiLaunchCount: number
  summary: string
}

async function getPublishedSet(): Promise<Map<string, { displayName: string | null; tier: string | null; behaviorFlags: string }>> {
  const profiles = await prisma.kolProfile.findMany({
    where: PUBLIC_KOL_FILTER,
    select: { handle: true, displayName: true, tier: true, behaviorFlags: true },
  })
  return new Map(profiles.map(p => [p.handle, p]))
}

export async function getRelatedActorsForProfile(handle: string): Promise<ClusterContext | null> {
  const published = await getPublishedSet()
  if (!published.has(handle)) return null

  // Find all tokens and cases for this handle
  const [myTokenLinks, myCases] = await Promise.all([
    prisma.kolTokenLink.findMany({ where: { kolHandle: handle, documentationStatus: { not: 'review' } }, select: { tokenSymbol: true, caseId: true } }),
    prisma.kolCase.findMany({ where: { kolHandle: handle }, select: { caseId: true } }),
  ])

  const myTokens = [...new Set(myTokenLinks.map(t => t.tokenSymbol).filter(Boolean))] as string[]
  const myCaseIds = [...new Set([...myCases.map(c => c.caseId), ...myTokenLinks.map(t => t.caseId).filter(Boolean)])] as string[]

  if (myTokens.length === 0 && myCaseIds.length === 0) {
    return { relatedActors: [], relatedLaunches: [], relatedCases: [], clusterSignals: [], overlapSummary: '' }
  }

  // Find other profiles linked to same tokens/cases
  const [tokenPeers, casePeers] = await Promise.all([
    myTokens.length > 0
      ? prisma.kolTokenLink.findMany({
          where: { tokenSymbol: { in: myTokens }, kolHandle: { not: handle }, documentationStatus: { not: 'review' } },
          select: { kolHandle: true, tokenSymbol: true, role: true, caseId: true },
        })
      : [],
    myCaseIds.length > 0
      ? prisma.kolCase.findMany({
          where: { caseId: { in: myCaseIds }, kolHandle: { not: handle } },
          select: { kolHandle: true, caseId: true, role: true },
        })
      : [],
  ])

  // Build related actor map
  const actorMap = new Map<string, { roles: Set<string>; tokens: Set<string>; cases: Set<string> }>()

  for (const p of tokenPeers) {
    if (!published.has(p.kolHandle)) continue
    let entry = actorMap.get(p.kolHandle)
    if (!entry) { entry = { roles: new Set(), tokens: new Set(), cases: new Set() }; actorMap.set(p.kolHandle, entry) }
    entry.roles.add(p.role)
    if (p.tokenSymbol) entry.tokens.add(p.tokenSymbol)
    if (p.caseId) entry.cases.add(p.caseId)
  }

  for (const p of casePeers) {
    if (!published.has(p.kolHandle)) continue
    let entry = actorMap.get(p.kolHandle)
    if (!entry) { entry = { roles: new Set(), tokens: new Set(), cases: new Set() }; actorMap.set(p.kolHandle, entry) }
    entry.roles.add(p.role)
    entry.cases.add(p.caseId)
  }

  const relatedActors: RelatedActor[] = []
  for (const [h, data] of actorMap) {
    const profile = published.get(h)!
    relatedActors.push({
      handle: h,
      displayName: profile.displayName,
      tier: profile.tier,
      roles: [...data.roles],
      sharedTokens: [...data.tokens],
      sharedCases: [...data.cases],
    })
  }

  // Build cluster signals
  const signals: ClusterSignal[] = []
  const allSharedTokens = [...new Set(relatedActors.flatMap(a => a.sharedTokens))]
  const allSharedCases = [...new Set(relatedActors.flatMap(a => a.sharedCases))]

  if (allSharedTokens.length > 0) {
    signals.push({
      type: 'shared_launch',
      label: `Shared across ${allSharedTokens.length} launch${allSharedTokens.length > 1 ? 'es' : ''}`,
      labelFr: `Present dans ${allSharedTokens.length} lancement${allSharedTokens.length > 1 ? 's' : ''}`,
      strength: allSharedTokens.length >= 3 ? 'strong' : allSharedTokens.length >= 2 ? 'moderate' : 'weak',
    })
  }

  if (allSharedCases.length > 0) {
    signals.push({
      type: 'shared_case',
      label: `Shared across ${allSharedCases.length} case${allSharedCases.length > 1 ? 's' : ''}`,
      labelFr: `Present dans ${allSharedCases.length} cas`,
      strength: allSharedCases.length >= 3 ? 'strong' : allSharedCases.length >= 2 ? 'moderate' : 'weak',
    })
  }

  // Multi-launch recurrence: actors appearing in 2+ launches together
  const multiLaunchActors = relatedActors.filter(a => a.sharedTokens.length >= 2)
  if (multiLaunchActors.length > 0) {
    signals.push({
      type: 'multi_launch_recurrence',
      label: `${multiLaunchActors.length} actor${multiLaunchActors.length > 1 ? 's' : ''} recur across multiple launches`,
      labelFr: `${multiLaunchActors.length} acteur${multiLaunchActors.length > 1 ? 's' : ''} recurrent${multiLaunchActors.length > 1 ? 's' : ''} sur plusieurs lancements`,
      strength: 'strong',
    })
  }

  // Shared behavior flags among related actors
  const allFlags = new Set<string>()
  for (const a of relatedActors) {
    const p = published.get(a.handle)
    if (p) for (const f of parseBehaviorFlags(p.behaviorFlags)) allFlags.add(f)
  }
  if (allFlags.size > 0) {
    signals.push({
      type: 'repeated_pattern',
      label: `${allFlags.size} shared behavior pattern${allFlags.size > 1 ? 's' : ''}`,
      labelFr: `${allFlags.size} schema${allFlags.size > 1 ? 's' : ''} comportemental${allFlags.size > 1 ? 'aux' : ''} partage${allFlags.size > 1 ? 's' : ''}`,
      strength: allFlags.size >= 3 ? 'strong' : 'moderate',
    })
  }

  const overlapSummary = relatedActors.length > 0
    ? `${relatedActors.length} related actor${relatedActors.length > 1 ? 's' : ''} documented across ${allSharedTokens.length} launch${allSharedTokens.length !== 1 ? 'es' : ''} and ${allSharedCases.length} case${allSharedCases.length !== 1 ? 's' : ''}`
    : ''

  return {
    relatedActors,
    relatedLaunches: allSharedTokens,
    relatedCases: allSharedCases,
    clusterSignals: signals,
    overlapSummary,
  }
}

export async function getClusterContextForLaunch(tokenSymbol: string): Promise<LaunchClusterContext> {
  const published = await getPublishedSet()

  const links = await prisma.kolTokenLink.findMany({
    where: { tokenSymbol, documentationStatus: { not: 'review' } },
    select: { kolHandle: true, role: true, caseId: true },
  })

  const actors: RelatedActor[] = []
  const caseIds = new Set<string>()
  const patterns = new Set<string>()

  for (const l of links) {
    const p = published.get(l.kolHandle)
    if (!p) continue
    actors.push({ handle: l.kolHandle, displayName: p.displayName, tier: p.tier, roles: [l.role], sharedTokens: [tokenSymbol], sharedCases: l.caseId ? [l.caseId] : [] })
    if (l.caseId) caseIds.add(l.caseId)
    for (const f of parseBehaviorFlags(p.behaviorFlags)) patterns.add(f)
  }

  return {
    linkedActors: actors,
    linkedCasesCount: caseIds.size,
    sharedPatterns: [...patterns],
    summary: actors.length > 0 ? `${actors.length} actor${actors.length > 1 ? 's' : ''} linked to ${tokenSymbol}` : '',
  }
}

export async function getClusterSignalsForCase(caseId: string): Promise<CaseClusterContext> {
  const published = await getPublishedSet()

  const caseEntries = await prisma.kolCase.findMany({
    where: { caseId },
    select: { kolHandle: true, role: true },
  })

  const handles = caseEntries.map(c => c.kolHandle).filter(h => published.has(h))

  const tokenLinks = handles.length > 0
    ? await prisma.kolTokenLink.findMany({
        where: { kolHandle: { in: handles }, documentationStatus: { not: 'review' } },
        select: { kolHandle: true, tokenSymbol: true },
      })
    : []

  const tokensByHandle = new Map<string, Set<string>>()
  for (const t of tokenLinks) {
    if (!t.tokenSymbol) continue
    let s = tokensByHandle.get(t.kolHandle)
    if (!s) { s = new Set(); tokensByHandle.set(t.kolHandle, s) }
    s.add(t.tokenSymbol)
  }

  const allTokens = [...new Set(tokenLinks.map(t => t.tokenSymbol).filter(Boolean))] as string[]
  const allFlags = new Set<string>()

  const actors: RelatedActor[] = []
  for (const e of caseEntries) {
    const p = published.get(e.kolHandle)
    if (!p) continue
    for (const f of parseBehaviorFlags(p.behaviorFlags)) allFlags.add(f)
    actors.push({
      handle: e.kolHandle,
      displayName: p.displayName,
      tier: p.tier,
      roles: [e.role],
      sharedTokens: [...(tokensByHandle.get(e.kolHandle) ?? [])],
      sharedCases: [caseId],
    })
  }

  const multiLaunchCount = actors.filter(a => a.sharedTokens.length >= 2).length

  return {
    linkedActors: actors,
    linkedTokens: allTokens,
    sharedBehaviorFlags: [...allFlags],
    multiLaunchCount,
    summary: actors.length > 0 ? `${actors.length} actor${actors.length > 1 ? 's' : ''} linked to ${caseId}` : '',
  }
}
