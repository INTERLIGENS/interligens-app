import { prisma } from '@/lib/prisma'
import { PUBLIC_KOL_FILTER } from '@/lib/kol/publishGate'
import { parseBehaviorFlags, type BehaviorFlagKey } from '@/lib/kol/behaviorFlags'

export type CoordinationSignalType =
  | 'coordinated_promotion'
  | 'repeated_cashout'
  | 'multi_launch_linked'
  | 'cross_case_recurrence'
  | 'known_linked_wallets'
  | 'shared_actor_group'
  | 'shared_launch_window'

export type SignalStrength = 'weak' | 'moderate' | 'strong'

export interface CoordinationSignal {
  type: CoordinationSignalType
  strength: SignalStrength
  labelEn: string
  labelFr: string
  reasonSummary: string
  supportingCount: number
  supportingFlags: string[]
}

export interface CoordinationContext {
  signals: CoordinationSignal[]
  strongestSignal: CoordinationSignal | null
  overallStrength: SignalStrength | null
  relatedActorsCount: number
  relatedLaunchesCount: number
  relatedCasesCount: number
  summaryEn: string
  summaryFr: string
}

const LABELS: Record<CoordinationSignalType, { en: string; fr: string }> = {
  coordinated_promotion:  { en: 'Coordinated promotion',      fr: 'Promotion coordonnee' },
  repeated_cashout:       { en: 'Repeated cashout pattern',    fr: 'Schema de cashout repete' },
  multi_launch_linked:    { en: 'Multi-launch linked',         fr: 'Lie a plusieurs lancements' },
  cross_case_recurrence:  { en: 'Cross-case recurrence',       fr: 'Recurrence multi-dossiers' },
  known_linked_wallets:   { en: 'Known linked wallets',        fr: 'Wallets lies documentes' },
  shared_actor_group:     { en: 'Shared actor group',          fr: "Groupe d'acteurs commun" },
  shared_launch_window:   { en: 'Shared launch window',        fr: 'Fenetre de lancement commune' },
}

const STRENGTH_ORDER: Record<SignalStrength, number> = { weak: 0, moderate: 1, strong: 2 }

function makeSignal(
  type: CoordinationSignalType,
  strength: SignalStrength,
  reason: string,
  count: number,
  flags: string[] = [],
): CoordinationSignal {
  return {
    type,
    strength,
    labelEn: LABELS[type].en,
    labelFr: LABELS[type].fr,
    reasonSummary: reason,
    supportingCount: count,
    supportingFlags: flags,
  }
}

export function summarizeCoordinationSignals(signals: CoordinationSignal[]): {
  strongestSignal: CoordinationSignal | null
  overallStrength: SignalStrength | null
} {
  if (signals.length === 0) return { strongestSignal: null, overallStrength: null }
  let best = signals[0]
  for (const s of signals) {
    if (STRENGTH_ORDER[s.strength] > STRENGTH_ORDER[best.strength]) best = s
  }
  return { strongestSignal: best, overallStrength: best.strength }
}

export async function getCoordinationSignalsForProfile(handle: string): Promise<CoordinationContext> {
  const empty: CoordinationContext = { signals: [], strongestSignal: null, overallStrength: null, relatedActorsCount: 0, relatedLaunchesCount: 0, relatedCasesCount: 0, summaryEn: '', summaryFr: '' }

  const profile = await prisma.kolProfile.findFirst({
    where: { handle: { equals: handle, mode: 'insensitive' }, ...PUBLIC_KOL_FILTER },
    select: { handle: true, behaviorFlags: true, walletAttributionStrength: true, totalDocumented: true },
  })
  if (!profile) return empty

  const flags = parseBehaviorFlags(profile.behaviorFlags)

  // Get linked tokens and cases
  const [tokenLinks, caseLinks] = await Promise.all([
    prisma.kolTokenLink.findMany({ where: { kolHandle: handle, documentationStatus: { not: 'review' } }, select: { tokenSymbol: true, caseId: true } }),
    prisma.kolCase.findMany({ where: { kolHandle: handle }, select: { caseId: true } }),
  ])

  const myTokens = [...new Set(tokenLinks.map(t => t.tokenSymbol).filter(Boolean))] as string[]
  const myCaseIds = [...new Set([...caseLinks.map(c => c.caseId), ...tokenLinks.map(t => t.caseId).filter(Boolean)])] as string[]

  // Find published peers
  const published = await prisma.kolProfile.findMany({
    where: PUBLIC_KOL_FILTER,
    select: { handle: true },
  })
  const publishedSet = new Set(published.map(p => p.handle))

  const peerTokenLinks = myTokens.length > 0
    ? await prisma.kolTokenLink.findMany({ where: { tokenSymbol: { in: myTokens }, kolHandle: { not: handle }, documentationStatus: { not: 'review' } }, select: { kolHandle: true, tokenSymbol: true } })
    : []
  const peerCaseLinks = myCaseIds.length > 0
    ? await prisma.kolCase.findMany({ where: { caseId: { in: myCaseIds }, kolHandle: { not: handle } }, select: { kolHandle: true, caseId: true } })
    : []

  const relatedHandles = new Set<string>()
  for (const p of [...peerTokenLinks, ...peerCaseLinks]) {
    if (publishedSet.has(p.kolHandle)) relatedHandles.add(p.kolHandle)
  }

  const relatedActorsCount = relatedHandles.size
  const relatedLaunchesCount = myTokens.length
  const relatedCasesCount = myCaseIds.length

  // Build signals
  const signals: CoordinationSignal[] = []

  // shared_actor_group
  if (relatedActorsCount >= 3 && relatedLaunchesCount >= 2) {
    signals.push(makeSignal('shared_actor_group', 'strong', `${relatedActorsCount} actors share ${relatedLaunchesCount} launches`, relatedActorsCount))
  } else if (relatedActorsCount >= 2 && relatedLaunchesCount >= 2) {
    signals.push(makeSignal('shared_actor_group', 'moderate', `${relatedActorsCount} actors share ${relatedLaunchesCount} launches`, relatedActorsCount))
  } else if (relatedActorsCount >= 2) {
    signals.push(makeSignal('shared_actor_group', 'weak', `${relatedActorsCount} related actors identified`, relatedActorsCount))
  }

  // coordinated_promotion
  if (flags.includes('COORDINATED_PROMOTION' as BehaviorFlagKey)) {
    const strength: SignalStrength = relatedActorsCount >= 2 ? 'strong' : 'moderate'
    signals.push(makeSignal('coordinated_promotion', strength, `Coordinated promotion flag documented${relatedActorsCount >= 2 ? ` with ${relatedActorsCount} linked actors` : ''}`, relatedActorsCount, ['COORDINATED_PROMOTION']))
  }

  // repeated_cashout
  if (flags.includes('REPEATED_CASHOUT' as BehaviorFlagKey)) {
    const strength: SignalStrength = (profile.totalDocumented ?? 0) > 0 ? 'strong' : 'moderate'
    signals.push(makeSignal('repeated_cashout', strength, `Repeated cashout pattern${(profile.totalDocumented ?? 0) > 0 ? ' with documented proceeds' : ''}`, 1, ['REPEATED_CASHOUT']))
  }

  // multi_launch_linked
  if (relatedLaunchesCount >= 3) {
    signals.push(makeSignal('multi_launch_linked', 'strong', `Linked to ${relatedLaunchesCount} launches`, relatedLaunchesCount, flags.includes('MULTI_LAUNCH_LINKED' as BehaviorFlagKey) ? ['MULTI_LAUNCH_LINKED'] : []))
  } else if (relatedLaunchesCount >= 2) {
    signals.push(makeSignal('multi_launch_linked', 'moderate', `Linked to ${relatedLaunchesCount} launches`, relatedLaunchesCount))
  } else if (relatedLaunchesCount === 1) {
    signals.push(makeSignal('multi_launch_linked', 'weak', `Linked to 1 launch`, 1))
  }

  // cross_case_recurrence
  if (relatedCasesCount >= 3) {
    signals.push(makeSignal('cross_case_recurrence', 'strong', `Appears in ${relatedCasesCount} cases`, relatedCasesCount))
  } else if (relatedCasesCount >= 2) {
    signals.push(makeSignal('cross_case_recurrence', 'moderate', `Appears in ${relatedCasesCount} cases`, relatedCasesCount))
  }

  // known_linked_wallets
  const ws = profile.walletAttributionStrength ?? 'none'
  if (ws === 'confirmed' || ws === 'high') {
    signals.push(makeSignal('known_linked_wallets', 'strong', `Wallet attribution: ${ws}`, 1, flags.includes('KNOWN_LINKED_WALLETS' as BehaviorFlagKey) ? ['KNOWN_LINKED_WALLETS'] : []))
  } else if (ws === 'medium') {
    signals.push(makeSignal('known_linked_wallets', 'moderate', 'Wallet attribution: medium confidence', 1))
  }

  // shared_launch_window — always weak
  if (relatedLaunchesCount >= 2 && relatedActorsCount >= 2) {
    signals.push(makeSignal('shared_launch_window', 'weak', 'Multiple actors active in overlapping launch windows', relatedActorsCount))
  }

  // Sort by strength desc
  signals.sort((a, b) => STRENGTH_ORDER[b.strength] - STRENGTH_ORDER[a.strength])

  const { strongestSignal, overallStrength } = summarizeCoordinationSignals(signals)

  const summaryEn = signals.length > 0
    ? `${signals.length} coordination signal${signals.length > 1 ? 's' : ''} documented across ${relatedLaunchesCount} launch${relatedLaunchesCount !== 1 ? 'es' : ''} and ${relatedCasesCount} case${relatedCasesCount !== 1 ? 's' : ''}`
    : ''
  const summaryFr = signals.length > 0
    ? `${signals.length} signal${signals.length > 1 ? 'aux' : ''} de coordination documente${signals.length > 1 ? 's' : ''} sur ${relatedLaunchesCount} lancement${relatedLaunchesCount !== 1 ? 's' : ''} et ${relatedCasesCount} cas`
    : ''

  return { signals, strongestSignal, overallStrength, relatedActorsCount, relatedLaunchesCount, relatedCasesCount, summaryEn, summaryFr }
}

export async function getCoordinationSignalsForLaunch(tokenSymbol: string): Promise<CoordinationContext> {
  const published = await prisma.kolProfile.findMany({ where: PUBLIC_KOL_FILTER, select: { handle: true, behaviorFlags: true, walletAttributionStrength: true } })
  const publishedMap = new Map(published.map(p => [p.handle, p]))

  const links = await prisma.kolTokenLink.findMany({ where: { tokenSymbol, documentationStatus: { not: 'review' } }, select: { kolHandle: true, caseId: true } })
  const actors = links.filter(l => publishedMap.has(l.kolHandle))
  const caseIds = [...new Set(links.map(l => l.caseId).filter(Boolean))]

  const allFlags = new Set<string>()
  for (const a of actors) {
    const p = publishedMap.get(a.kolHandle)
    if (p) for (const f of parseBehaviorFlags(p.behaviorFlags)) allFlags.add(f)
  }

  const signals: CoordinationSignal[] = []
  const actorCount = new Set(actors.map(a => a.kolHandle)).size

  if (actorCount >= 3) signals.push(makeSignal('shared_actor_group', 'strong', `${actorCount} actors linked to ${tokenSymbol}`, actorCount))
  else if (actorCount >= 2) signals.push(makeSignal('shared_actor_group', 'moderate', `${actorCount} actors linked to ${tokenSymbol}`, actorCount))

  if (allFlags.has('COORDINATED_PROMOTION')) signals.push(makeSignal('coordinated_promotion', actorCount >= 2 ? 'strong' : 'moderate', 'Coordinated promotion documented', actorCount, ['COORDINATED_PROMOTION']))
  if (caseIds.length >= 2) signals.push(makeSignal('cross_case_recurrence', 'moderate', `Linked to ${caseIds.length} cases`, caseIds.length))

  signals.sort((a, b) => STRENGTH_ORDER[b.strength] - STRENGTH_ORDER[a.strength])
  const { strongestSignal, overallStrength } = summarizeCoordinationSignals(signals)

  return {
    signals, strongestSignal, overallStrength,
    relatedActorsCount: actorCount, relatedLaunchesCount: 1, relatedCasesCount: caseIds.length,
    summaryEn: signals.length > 0 ? `${signals.length} coordination signal${signals.length > 1 ? 's' : ''} for ${tokenSymbol}` : '',
    summaryFr: signals.length > 0 ? `${signals.length} signal${signals.length > 1 ? 'aux' : ''} de coordination pour ${tokenSymbol}` : '',
  }
}

export async function getCoordinationSignalsForCase(caseId: string): Promise<CoordinationContext> {
  const published = await prisma.kolProfile.findMany({ where: PUBLIC_KOL_FILTER, select: { handle: true, behaviorFlags: true, walletAttributionStrength: true } })
  const publishedMap = new Map(published.map(p => [p.handle, p]))

  const entries = await prisma.kolCase.findMany({ where: { caseId }, select: { kolHandle: true, role: true } })
  const actors = entries.filter(e => publishedMap.has(e.kolHandle))
  const actorHandles = [...new Set(actors.map(a => a.kolHandle))]

  // Find shared tokens
  const tokenLinks = actorHandles.length > 0
    ? await prisma.kolTokenLink.findMany({ where: { kolHandle: { in: actorHandles }, documentationStatus: { not: 'review' } }, select: { kolHandle: true, tokenSymbol: true } })
    : []
  const tokenCount = new Set(tokenLinks.map(t => t.tokenSymbol).filter(Boolean)).size

  const allFlags = new Set<string>()
  for (const h of actorHandles) {
    const p = publishedMap.get(h)
    if (p) for (const f of parseBehaviorFlags(p.behaviorFlags)) allFlags.add(f)
  }

  const signals: CoordinationSignal[] = []

  if (actorHandles.length >= 3) signals.push(makeSignal('shared_actor_group', 'strong', `${actorHandles.length} actors in case ${caseId}`, actorHandles.length))
  else if (actorHandles.length >= 2) signals.push(makeSignal('shared_actor_group', 'moderate', `${actorHandles.length} actors in case ${caseId}`, actorHandles.length))

  if (tokenCount >= 3) signals.push(makeSignal('multi_launch_linked', 'strong', `Actors linked to ${tokenCount} launches`, tokenCount))
  else if (tokenCount >= 2) signals.push(makeSignal('multi_launch_linked', 'moderate', `Actors linked to ${tokenCount} launches`, tokenCount))

  if (allFlags.has('COORDINATED_PROMOTION')) signals.push(makeSignal('coordinated_promotion', actorHandles.length >= 2 ? 'strong' : 'moderate', 'Coordinated promotion documented', actorHandles.length, ['COORDINATED_PROMOTION']))
  if (allFlags.has('REPEATED_CASHOUT')) signals.push(makeSignal('repeated_cashout', 'moderate', 'Repeated cashout pattern in case actors', actorHandles.length, ['REPEATED_CASHOUT']))

  signals.sort((a, b) => STRENGTH_ORDER[b.strength] - STRENGTH_ORDER[a.strength])
  const { strongestSignal, overallStrength } = summarizeCoordinationSignals(signals)

  return {
    signals, strongestSignal, overallStrength,
    relatedActorsCount: actorHandles.length, relatedLaunchesCount: tokenCount, relatedCasesCount: 1,
    summaryEn: signals.length > 0 ? `${signals.length} coordination signal${signals.length > 1 ? 's' : ''} for case ${caseId}` : '',
    summaryFr: signals.length > 0 ? `${signals.length} signal${signals.length > 1 ? 'aux' : ''} de coordination pour le cas ${caseId}` : '',
  }
}
