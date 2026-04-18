// src/app/api/watchlist/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handlesV2 } from '@/lib/watcher/handles'
import { parseBehaviorFlags } from '@/lib/kol/behaviorFlags'
import { isKolPublic } from '@/lib/kol/publishGate'

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

    // 2b. Tickers — primary source: curated KolTokenLink (editorial),
    // fallback: KolPromotionMention (raw signals from posts).
    const handlesForTokenLookup = kolProfiles.map(k => k.handle)

    const [curatedLinks, mentionLinks, involvements] = handlesForTokenLookup.length
      ? await Promise.all([
          prisma.kolTokenLink.findMany({
            where: { kolHandle: { in: handlesForTokenLookup, mode: 'insensitive' }, tokenSymbol: { not: null } },
            select: { kolHandle: true, tokenSymbol: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.kolPromotionMention.findMany({
            where: { kolHandle: { in: handlesForTokenLookup, mode: 'insensitive' }, tokenSymbol: { not: null } },
            select: { kolHandle: true, tokenSymbol: true, postedAt: true },
            orderBy: { postedAt: 'desc' },
          }),
          prisma.kolTokenInvolvement.findMany({
            where: {
              kolHandle: { in: handlesForTokenLookup, mode: 'insensitive' },
              proceedsUsd: { not: null },
            },
            select: { kolHandle: true, proceedsUsd: true, firstSellAt: true },
          }),
        ])
      : [[], [], []]

    // Build tickers per handle (curated first, mentions filling)
    const tickersByHandle = new Map<string, string[]>()
    const TICKERS_LIMIT = 6
    function pushTicker(handleLc: string, raw: string | null) {
      if (!raw) return
      const sym = raw.replace(/^\$+/, '').toUpperCase().trim()
      if (!sym || sym.length > 12) return
      const arr = tickersByHandle.get(handleLc) ?? []
      if (arr.includes(sym) || arr.length >= TICKERS_LIMIT) return
      arr.push(sym)
      tickersByHandle.set(handleLc, arr)
    }
    for (const r of curatedLinks) pushTicker(r.kolHandle.toLowerCase(), r.tokenSymbol)
    for (const r of mentionLinks) pushTicker(r.kolHandle.toLowerCase(), r.tokenSymbol)

    // Cashout buckets per handle from KolTokenInvolvement
    const now = Date.now()
    const D1 = now - 24 * 60 * 60 * 1000
    const D7 = now - 7 * 24 * 60 * 60 * 1000
    const D30 = now - 30 * 24 * 60 * 60 * 1000
    const YTD_START = new Date(new Date().getFullYear(), 0, 1).getTime()

    interface Bucket {
      d1: number
      d7: number
      d30: number
      ytd: number
      total: number
    }
    const cashoutByHandle = new Map<string, Bucket>()
    for (const inv of involvements) {
      const key = inv.kolHandle.toLowerCase()
      const usd = inv.proceedsUsd ? Number(inv.proceedsUsd) : 0
      if (!usd) continue
      const b = cashoutByHandle.get(key) ?? { d1: 0, d7: 0, d30: 0, ytd: 0, total: 0 }
      b.total += usd
      const sellTs = inv.firstSellAt ? new Date(inv.firstSellAt).getTime() : null
      if (sellTs != null) {
        if (sellTs >= D1) b.d1 += usd
        if (sellTs >= D7) b.d7 += usd
        if (sellTs >= D30) b.d30 += usd
        if (sellTs >= YTD_START) b.ytd += usd
      }
      cashoutByHandle.set(key, b)
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
      const handleLc = wh.handle.toLowerCase()
      const kol = kolMap.get(handleLc)
      const signals = signalsByHandle.get(handleLc)
      const flags = kol?.behaviorFlags ? parseBehaviorFlags(kol.behaviorFlags) : []
      const tickers = tickersByHandle.get(handleLc) ?? []
      const cashout = cashoutByHandle.get(handleLc) ?? { d1: 0, d7: 0, d30: 0, ytd: 0, total: 0 }

      return {
        tickers,
        cashout,
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
        isPublished: kol ? isKolPublic(kol) : false,
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
