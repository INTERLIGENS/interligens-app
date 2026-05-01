import { PreflightInput, PreflightResult } from './types'
import { isLabEnabled } from '../featureFlags'

export async function runInterligensPreflight(input: PreflightInput): Promise<PreflightResult> {
  if (!isLabEnabled('walletLab')) {
    return { score: 0, tier: 'UNKNOWN', allow: true, signals: [] }
  }

  try {
    const res = await fetch(`/api/v1/score?address=${encodeURIComponent(input.targetAddress)}&chain=${encodeURIComponent(input.chain)}`)
    if (!res.ok) throw new Error(`Score API error: ${res.status}`)
    const data = await res.json() as { score?: number; tier?: string; signals?: string[] }
    const score = data.score ?? 0
    const tier = data.tier ?? 'UNKNOWN'
    const signals = data.signals ?? []
    const allow = score < 70
    const warning = score >= 40 && score < 70 ? `Risk score ${score} — review before proceeding` : undefined
    return { score, tier, allow, warning, signals }
  } catch {
    return { score: 0, tier: 'UNKNOWN', allow: true, signals: [] }
  }
}
