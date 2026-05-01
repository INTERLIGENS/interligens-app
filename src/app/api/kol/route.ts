import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rateLimit'
import { buildKolCanonicalSnapshotBatch } from '@/lib/kol/canonical'
import { PUBLIC_KOL_FILTER } from '@/lib/kol/publishGate'

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.public)
  if (!rl.allowed) return rateLimitResponse(rl)

  try {
    const kols = await buildKolCanonicalSnapshotBatch(
      { riskFlag: { not: 'unverified' }, ...PUBLIC_KOL_FILTER },
      { totalScammed: 'desc' },
    )
    return NextResponse.json({ kols })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
