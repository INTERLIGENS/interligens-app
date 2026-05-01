export interface ScanResult {
  address: string
  score: number
  tier: string
  signals: string[]
  allow: boolean
  warning?: string
}

export async function scanAddress(address: string): Promise<ScanResult> {
  const res = await fetch(`/api/v1/score?address=${encodeURIComponent(address)}&chain=SOL`)
  if (!res.ok) throw new Error(`Scan failed: ${res.status}`)
  const data = await res.json() as { score?: number; tier?: string; signals?: string[] }
  const score = data.score ?? 0
  const tier = data.tier ?? 'UNKNOWN'
  const signals = data.signals ?? []
  const allow = score < 70
  const warning = score >= 40 && score < 70 ? `Risk score ${score} — proceed with caution` : undefined
  return { address, score, tier, signals, allow, warning }
}
