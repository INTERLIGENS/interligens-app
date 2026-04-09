// src/app/api/watchlist/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlesV2 } from '@/lib/watcher/handles'
import { parseBehaviorFlags } from '@/lib/kol/behaviorFlags'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Deduplicate watcher handles (keep highest priority)
    const PRIORITY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 }
    const handleMap = new Map<string, (typeof handlesV2)[number]>()
    for (const h of handlesV2) {
      const existing = handleMap.get(h.handle.toLowerCase())
      if (!existing || PRIORITY_RANK[h.priority] > PRIORITY_RANK[existing.priority]) {
        handleMap.set(h.handle.toLowerCase(), h)
      }
    }
    const uniqueHandles = Array.from(handleMap.values())
    const handleKeys = uniqueHandles.map(h => h.handle)

    // 2. Batch-fetch KOL profiles for matching handles
    const kolProfiles = await prisma.kolProfile.findMany({
      where: { handle: { in: handleKeys, mode: 'insensitive' } },
      select: {
        handle: true,
        displayName: true,
        tier: true,
        riskFlag: true,
        totalDocumented: true,
        totalScammed: true,
        proceedsCoverage: true,
        evidenceDepth: true,
        completenessLevel: true,
        behaviorFlags: true,
        followerCount: true,
        bio: true,
        rugCount: true,
        publishStatus: true,
        publishable: true,
        verified: true,
        updatedAt: true,
        _count: {
          select: {
            evidences: true,
            kolWallets: true,
            kolCases: true,
            tokenLinks: true,
          },
        },
      },
    })

    const kolMap = new Map<string, (typeof kolProfiles)[number]>()
    for (const kp of kolProfiles) {
      kolMap.set(kp.handle.toLowerCase(), kp)
    }

    // 3. Fetch recent signal activity (last 30 days, SocialPostCandidates)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recentCandidates = await prisma.socialPostCandidate.groupBy({
      by: ['influencerId'],
      where: { discoveredAtUtc: { gte: thirtyDaysAgo } },
      _count: { id: true },
      _max: { discoveredAtUtc: true },
    })

    // Map influencer IDs to handles
    const influencerIds = recentCandidates.map(c => c.influencerId)
    const influencers = influencerIds.length > 0
      ? await prisma.influencer.findMany({
          where: { id: { in: influencerIds } },
          select: { id: true, handle: true },
        })
      : []
    const infIdToHandle = new Map<string, string>()
    for (const inf of influencers) {
      infIdToHandle.set(inf.id, inf.handle.toLowerCase())
    }
    const signalsByHandle = new Map<string, { count: number; lastSeen: Date | null }>()
    for (const c of recentCandidates) {
      const handle = infIdToHandle.get(c.influencerId)
      if (handle) {
        signalsByHandle.set(handle, { count: c._count.id, lastSeen: c._max.discoveredAtUtc })
      }
    }

    // 4. Merge and build response
    const entries = uniqueHandles.map(wh => {
      const kol = kolMap.get(wh.handle.toLowerCase())
      const signals = signalsByHandle.get(wh.handle.toLowerCase())
      const flags = kol?.behaviorFlags ? parseBehaviorFlags(kol.behaviorFlags) : []

      return {
        // Watcher data
        handle: wh.handle,
        displayName: kol?.displayName ?? wh.handle,
        priority: wh.priority,
        category: wh.category,
        source: wh.source,
        chainFocus: wh.chainFocus,
        followerCount: kol?.followerCount ?? wh.followerCount,
        notes: wh.notes ?? null,

        // KOL profile data (null if no profile)
        hasProfile: !!kol,
        tier: kol?.tier ?? null,
        riskFlag: kol?.riskFlag ?? null,
        totalProceeds: kol?.totalDocumented ?? null,
        totalScammed: kol?.totalScammed ?? null,
        proceedsCoverage: kol?.proceedsCoverage ?? null,
        evidenceDepth: kol?.evidenceDepth ?? null,
        completenessLevel: kol?.completenessLevel ?? null,
        behaviorFlags: flags,
        behaviorFlagsCount: flags.length,
        rugCount: kol?.rugCount ?? null,
        verified: kol?.verified ?? false,
        evidenceCount: kol?._count.evidences ?? 0,
        walletsCount: kol?._count.kolWallets ?? 0,
        casesCount: kol?._count.kolCases ?? 0,
        linkedTokensCount: kol?._count.tokenLinks ?? 0,
        isPublished: kol?.publishStatus === 'published' || (kol?.publishable === true && kol?.publishStatus === 'draft'),
        lastUpdated: kol?.updatedAt ?? null,

        // Signal activity (from watcher v2)
        recentSignals: signals?.count ?? 0,
        lastSignalAt: signals?.lastSeen ?? null,
      }
    })

    // Sort: high priority first, then by proceeds, then by signals
    entries.sort((a, b) => {
      const pa = PRIORITY_RANK[a.priority] ?? 0
      const pb = PRIORITY_RANK[b.priority] ?? 0
      if (pa !== pb) return pb - pa
      const procA = a.totalProceeds ?? 0
      const procB = b.totalProceeds ?? 0
      if (procA !== procB) return procB - procA
      return b.recentSignals - a.recentSignals
    })

    // 5. Compute stats
    const stats = {
      totalTracked: entries.length,
      highPriority: entries.filter(e => e.priority === 'high').length,
      withProfiles: entries.filter(e => e.hasProfile).length,
      withProceeds: entries.filter(e => (e.totalProceeds ?? 0) > 0).length,
      totalProceeds: entries.reduce((s, e) => s + (e.totalProceeds ?? 0), 0),
      totalEvidence: entries.reduce((s, e) => s + e.evidenceCount, 0),
      withRecentSignals: entries.filter(e => e.recentSignals > 0).length,
      totalRecentSignals: entries.reduce((s, e) => s + e.recentSignals, 0),
      sources: [...new Set(entries.map(e => e.source))].length,
    }

    return NextResponse.json({ entries, stats })
  } catch (error) {
    console.error('[watchlist] error:', error)
    return NextResponse.json({ error: 'Failed to load watchlist' }, { status: 500 })
  }
}
