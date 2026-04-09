// src/app/api/watchlist/signals/route.ts
// Recent signals feed — individual SocialPostCandidate entries
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Fetch the 40 most recent signal candidates (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const candidates = await prisma.socialPostCandidate.findMany({
      where: { discoveredAtUtc: { gte: thirtyDaysAgo } },
      orderBy: { discoveredAtUtc: 'desc' },
      take: 40,
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
        influencer: {
          select: { handle: true },
        },
      },
    })

    // Parse JSON string fields and build response
    const signals = candidates.map(c => {
      let signalTypes: string[] = []
      let detectedTokens: string[] = []
      let detectedAddresses: string[] = []

      try { signalTypes = JSON.parse(c.signalTypes ?? '[]') } catch {}
      try { detectedTokens = JSON.parse(c.detectedTokens ?? '[]') } catch {}
      try { detectedAddresses = JSON.parse(c.detectedAddresses ?? '[]') } catch {}

      return {
        id: c.id,
        handle: c.influencer.handle,
        postUrl: c.postUrl,
        discoveredAt: c.discoveredAtUtc,
        postedAt: c.postedAtUtc,
        signalScore: c.signalScore,
        signalTypes,
        detectedTokens,
        detectedAddresses,
        hasCA: detectedAddresses.length > 0,
      }
    })

    // Coordination detection: find handles with signals within 30min windows
    const coordination: Array<{
      handles: string[]
      window: string
      signalCount: number
      timestamp: string
    }> = []

    // Group signals by 30-minute windows
    const windowMs = 30 * 60 * 1000
    const windowMap = new Map<number, Array<{ handle: string; timestamp: Date }>>()

    for (const s of signals) {
      const ts = new Date(s.postedAt ?? s.discoveredAt).getTime()
      const windowKey = Math.floor(ts / windowMs)

      if (!windowMap.has(windowKey)) windowMap.set(windowKey, [])
      windowMap.get(windowKey)!.push({ handle: s.handle, timestamp: new Date(ts) })
    }

    for (const [windowKey, entries] of windowMap) {
      const uniqueHandles = [...new Set(entries.map(e => e.handle))]
      if (uniqueHandles.length >= 2) {
        coordination.push({
          handles: uniqueHandles,
          window: '30min',
          signalCount: entries.length,
          timestamp: new Date(windowKey * windowMs).toISOString(),
        })
      }
    }

    // Sort coordination by signal count desc
    coordination.sort((a, b) => b.signalCount - a.signalCount)

    return NextResponse.json({
      signals,
      coordination: coordination.slice(0, 10),
      meta: {
        total: signals.length,
        period: '30d',
        coordinationClusters: coordination.length,
      },
    })
  } catch (error) {
    console.error('[watchlist/signals] error:', error)
    return NextResponse.json({ error: 'Failed to load signals' }, { status: 500 })
  }
}
