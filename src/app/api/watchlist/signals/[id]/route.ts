// src/app/api/watchlist/signals/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isKolPublic } from '@/lib/kol/publishGate'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const candidate = await prisma.socialPostCandidate.findUnique({
      where: { id },
      select: {
        id: true,
        postUrl: true,
        postId: true,
        discoveredAtUtc: true,
        postedAtUtc: true,
        sourceProvider: true,
        status: true,
        detectedTokens: true,
        detectedAddresses: true,
        signalTypes: true,
        signalScore: true,
        profileSnapshot: true,
        influencer: {
          select: { handle: true, platform: true },
        },
      },
    })

    if (!candidate) {
      return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
    }

    // Parse JSON fields
    let signalTypes: string[] = []
    let detectedTokens: string[] = []
    let detectedAddresses: string[] = []
    let profileData: { followers?: number; bio?: string; fetchedAt?: string } | null = null

    try { signalTypes = JSON.parse(candidate.signalTypes ?? '[]') } catch {}
    try { detectedTokens = JSON.parse(candidate.detectedTokens ?? '[]') } catch {}
    try { detectedAddresses = JSON.parse(candidate.detectedAddresses ?? '[]') } catch {}
    try { if (candidate.profileSnapshot) profileData = JSON.parse(candidate.profileSnapshot) } catch {}

    // Look up KOL profile for this handle
    const handle = candidate.influencer.handle
    const kolProfile = await prisma.kolProfile.findUnique({
      where: { handle },
      select: {
        handle: true,
        displayName: true,
        tier: true,
        riskFlag: true,
        totalDocumented: true,
        evidenceDepth: true,
        completenessLevel: true,
        behaviorFlags: true,
        publishStatus: true,
        publishable: true,
        _count: {
          select: { evidences: true, kolWallets: true, kolCases: true },
        },
      },
    })

    // Find other recent signals from same handle (context)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const relatedSignals = await prisma.socialPostCandidate.findMany({
      where: {
        influencer: { handle },
        id: { not: id },
        discoveredAtUtc: { gte: thirtyDaysAgo },
      },
      orderBy: { discoveredAtUtc: 'desc' },
      take: 5,
      select: {
        id: true,
        postUrl: true,
        discoveredAtUtc: true,
        postedAtUtc: true,
        signalTypes: true,
        signalScore: true,
      },
    })

    const related = relatedSignals.map(r => ({
      id: r.id,
      postUrl: r.postUrl,
      discoveredAt: r.discoveredAtUtc,
      postedAt: r.postedAtUtc,
      signalTypes: (() => { try { return JSON.parse(r.signalTypes ?? '[]') } catch { return [] } })(),
      signalScore: r.signalScore,
    }))

    return NextResponse.json({
      signal: {
        id: candidate.id,
        handle,
        platform: candidate.influencer.platform,
        postUrl: candidate.postUrl,
        postId: candidate.postId,
        discoveredAt: candidate.discoveredAtUtc,
        postedAt: candidate.postedAtUtc,
        sourceProvider: candidate.sourceProvider,
        status: candidate.status,
        signalScore: candidate.signalScore,
        signalTypes,
        detectedTokens,
        detectedAddresses,
        hasCA: detectedAddresses.length > 0,
        profile: profileData,
      },
      kol: kolProfile ? {
        handle: kolProfile.handle,
        displayName: kolProfile.displayName,
        tier: kolProfile.tier,
        riskFlag: kolProfile.riskFlag,
        totalProceeds: kolProfile.totalDocumented,
        evidenceDepth: kolProfile.evidenceDepth,
        completenessLevel: kolProfile.completenessLevel,
        evidenceCount: kolProfile._count.evidences,
        walletsCount: kolProfile._count.kolWallets,
        casesCount: kolProfile._count.kolCases,
        isPublished: isKolPublic(kolProfile),
      } : null,
      relatedSignals: related,
    })
  } catch (error) {
    console.error('[watchlist/signals/id] error:', error)
    return NextResponse.json({ error: 'Failed to load signal' }, { status: 500 })
  }
}
