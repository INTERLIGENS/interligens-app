import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PUBLIC_KOL_FILTER } from '@/lib/kol/publishGate'

export async function GET() {
  try {
    const kols = await prisma.kolProfile.findMany({
      select: {
        handle: true,
        displayName: true,
        platform: true,
        riskFlag: true,
        rugCount: true,
        totalScammed: true,
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

    // Enrichir avec totalDocumented depuis KolEvidence
    const enriched = await Promise.all(kols.map(async (kol) => {
      const evs = await prisma.kolEvidence.aggregate({
        where: { kolHandle: kol.handle },
        _sum: { amountUsd: true },
      })
      return {
        ...kol,
        totalDocumented: evs._sum.amountUsd || 0,
      }
    }))

    return NextResponse.json({ kols: enriched })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
