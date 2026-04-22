import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PUBLIC_KOL_FILTER } from '@/lib/kol/publishGate'

export async function GET() {
  try {
    // totalDocumented is kept in lockstep with SUM(KolProceedsEvent.amountUsd)
    // by the Helius scan + /api/admin/kol/sync-proceeds. Read it straight from
    // KolProfile rather than re-aggregating — prior enrichment summed
    // KolEvidence.amountUsd, which ignored on-chain events and left the
    // Explorer stuck at historical values.
    const kols = await prisma.kolProfile.findMany({
      select: {
        handle: true,
        displayName: true,
        platform: true,
        riskFlag: true,
        rugCount: true,
        totalScammed: true,
        totalDocumented: true,
        verified: true,
        confidence: true,
        followerCount: true,
        exitDate: true,
        evmAddress: true,
        summary: true,
        evidenceDepth: true,
        completenessLevel: true,
        profileStrength: true,
        behaviorFlags: true,
      },
      where: { riskFlag: { not: 'unverified' }, ...PUBLIC_KOL_FILTER },
      orderBy: { totalScammed: 'desc' },
    })

    const enriched = kols.map((kol) => ({
      ...kol,
      totalDocumented: kol.totalDocumented ?? 0,
    }))

    return NextResponse.json({ kols: enriched })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
