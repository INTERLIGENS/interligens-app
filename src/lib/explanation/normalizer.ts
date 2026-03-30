import type { AnalysisSummary, Verdict } from './types'

// Adapts NormalizedScan (from demo page) → AnalysisSummary
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeToAnalysisSummary(raw: Record<string, any>): AnalysisSummary {
  const score = Number(raw?.score ?? 0)

  const verdict = tierToVerdict(raw?.tier, score)

  // topReasons: extract from proofs where level is high or medium
  const proofs: any[] = Array.isArray(raw?.proofs) ? raw.proofs : []
  const topReasons = proofs
    .filter((p) => p.level === 'high' || p.level === 'medium')
    .map((p) => p.riskDescription)
    .filter(Boolean)
    .slice(0, 3)

  // exitSecurityFlags: proofs where level is high
  const exitSecurityFlags = proofs
    .filter((p) => p.level === 'high')
    .map((p) => p.label)
    .filter(Boolean)

  // whatToDoNow: first recommendation
  const recommendations: string[] = Array.isArray(raw?.recommendations) ? raw.recommendations : []
  const whatToDoNow = recommendations[0] ?? undefined

  return {
    address: String(raw?.address ?? raw?.rawSummary?.address ?? ''),
    chain: String(raw?.chain ?? 'Unknown'),
    tigerScore: score,
    verdict,
    topReasons,
    exitSecurityFlags: exitSecurityFlags.length > 0 ? exitSecurityFlags : undefined,
    whatToDoNow,
    // These require deeper scan data not yet in NormalizedScan — undefined for Phase 1A
    holderConcentration: undefined,
    deployerRisk: undefined,
    recidivismFlag: undefined,
    linkedProjects: undefined,
    liquidityRisk: undefined,
    intelVaultMatches: undefined,
    proofSnippets: undefined,
  }
}

function tierToVerdict(tier?: string, score?: number): Verdict {
  const t = String(tier ?? '').toUpperCase()
  if (t === 'RED')    return 'CRITICAL'
  if (t === 'ORANGE') return 'HIGH'
  if (t === 'GREEN')  return 'LOW'
  // fallback by score
  const s = Number(score ?? 0)
  if (s >= 70) return 'CRITICAL'
  if (s >= 40) return 'HIGH'
  return 'LOW'
}
