// src/app/api/scan/resolve/route.ts
//
// Resolve a ticker symbol → list of candidate (address, chain) pairs.
// Source order: KolTokenLink (curated) → KolPromotionMention (live) →
// CoinGecko /search (external fallback). Internal hits always rank first.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ResolveSource = 'curated' | 'mentions' | 'coingecko'
type ScanChain = 'SOL' | 'ETH' | 'BSC' | 'TRON' | 'HYPER'

interface Candidate {
  symbol: string
  address: string
  chain: ScanChain
  source: ResolveSource
  kolCount: number
  name?: string
}

const PLATFORM_TO_CHAIN: Record<string, ScanChain | undefined> = {
  ethereum: 'ETH',
  'binance-smart-chain': 'BSC',
  solana: 'SOL',
  tron: 'TRON',
}

const SOURCE_RANK: Record<ResolveSource, number> = {
  curated: 3,
  mentions: 2,
  coingecko: 1,
}

function normalizeChain(raw: string | null | undefined): ScanChain | null {
  if (!raw) return null
  const c = raw.toUpperCase()
  if (c === 'SOL' || c === 'SOLANA') return 'SOL'
  if (c === 'ETH' || c === 'ETHEREUM') return 'ETH'
  if (c === 'BSC' || c === 'BNB' || c === 'BINANCE') return 'BSC'
  if (c === 'TRON' || c === 'TRX') return 'TRON'
  if (c === 'HYPER' || c === 'HYPERLIQUID') return 'HYPER'
  return null
}

function normalizeAddressForChain(addr: string, chain: ScanChain): string {
  const trimmed = addr.trim()
  if (chain === 'ETH' || chain === 'BSC' || chain === 'HYPER') return trimmed.toLowerCase()
  return trimmed
}

function dedupeKey(c: Pick<Candidate, 'address' | 'chain'>): string {
  return c.chain + ':' + c.address.toLowerCase()
}

function cleanTicker(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.replace(/^\$+/, '').toUpperCase().trim()
}

async function fetchCuratedHits(symbol: string): Promise<Candidate[]> {
  const rows = await prisma.kolTokenLink.findMany({
    where: {
      OR: [
        { tokenSymbol: symbol },
        { tokenSymbol: '$' + symbol },
        { tokenSymbol: symbol.toLowerCase() },
      ],
    },
    select: { kolHandle: true, contractAddress: true, chain: true, tokenSymbol: true },
  })

  const grouped = new Map<string, { addr: string; chain: ScanChain; symbol: string; handles: Set<string> }>()
  for (const r of rows) {
    const chain = normalizeChain(r.chain)
    if (!chain) continue
    const addr = normalizeAddressForChain(r.contractAddress, chain)
    const key = chain + ':' + addr.toLowerCase()
    const existing = grouped.get(key)
    if (existing) {
      existing.handles.add(r.kolHandle.toLowerCase())
    } else {
      grouped.set(key, {
        addr,
        chain,
        symbol: cleanTicker(r.tokenSymbol) || symbol,
        handles: new Set([r.kolHandle.toLowerCase()]),
      })
    }
  }

  return Array.from(grouped.values()).map(g => ({
    symbol: g.symbol,
    address: g.addr,
    chain: g.chain,
    source: 'curated' as const,
    kolCount: g.handles.size,
  }))
}

async function fetchMentionHits(symbol: string): Promise<Candidate[]> {
  const rows = await prisma.kolPromotionMention.findMany({
    where: {
      OR: [
        { tokenSymbol: symbol },
        { tokenSymbol: '$' + symbol },
        { tokenSymbol: symbol.toLowerCase() },
      ],
    },
    select: { kolHandle: true, tokenMint: true, chain: true, tokenSymbol: true },
  })

  const grouped = new Map<string, { addr: string; chain: ScanChain; symbol: string; handles: Set<string> }>()
  for (const r of rows) {
    const chain = normalizeChain(r.chain)
    if (!chain) continue
    const addr = normalizeAddressForChain(r.tokenMint, chain)
    const key = chain + ':' + addr.toLowerCase()
    const existing = grouped.get(key)
    if (existing) {
      existing.handles.add(r.kolHandle.toLowerCase())
    } else {
      grouped.set(key, {
        addr,
        chain,
        symbol: cleanTicker(r.tokenSymbol) || symbol,
        handles: new Set([r.kolHandle.toLowerCase()]),
      })
    }
  }

  return Array.from(grouped.values()).map(g => ({
    symbol: g.symbol,
    address: g.addr,
    chain: g.chain,
    source: 'mentions' as const,
    kolCount: g.handles.size,
  }))
}

async function fetchCoinGeckoHits(symbol: string): Promise<Candidate[]> {
  try {
    // /search returns coins matched by symbol/name; we then need /coins/{id}
    // for contract addresses. Stop after the first 3 hits to keep latency
    // low — retail won't read more than that anyway.
    const searchRes = await fetch(
      'https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(symbol),
      { next: { revalidate: 600 }, headers: { accept: 'application/json' } },
    )
    if (!searchRes.ok) return []
    const search = (await searchRes.json()) as {
      coins?: { id: string; symbol: string; name: string }[]
    }
    const top = (search.coins ?? [])
      .filter(c => c.symbol?.toUpperCase() === symbol)
      .slice(0, 3)
    if (top.length === 0) return []

    const detailed = await Promise.all(
      top.map(async c => {
        try {
          const r = await fetch(
            `https://api.coingecko.com/api/v3/coins/${c.id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
            { next: { revalidate: 3600 }, headers: { accept: 'application/json' } },
          )
          if (!r.ok) return null
          const detail = (await r.json()) as {
            id: string
            symbol: string
            name: string
            platforms?: Record<string, string>
          }
          return detail
        } catch {
          return null
        }
      }),
    )

    const out: Candidate[] = []
    for (const detail of detailed) {
      if (!detail?.platforms) continue
      for (const [platform, addr] of Object.entries(detail.platforms)) {
        const chain = PLATFORM_TO_CHAIN[platform]
        if (!chain || !addr) continue
        out.push({
          symbol: detail.symbol.toUpperCase(),
          address: normalizeAddressForChain(addr, chain),
          chain,
          source: 'coingecko',
          kolCount: 0,
          name: detail.name,
        })
      }
    }
    return out
  } catch {
    return []
  }
}

function mergeCandidates(...lists: Candidate[][]): Candidate[] {
  const map = new Map<string, Candidate>()
  for (const list of lists) {
    for (const c of list) {
      const k = dedupeKey(c)
      const existing = map.get(k)
      if (!existing) {
        map.set(k, c)
        continue
      }
      // Higher source rank wins; combine kolCount.
      const existingRank = SOURCE_RANK[existing.source]
      const incomingRank = SOURCE_RANK[c.source]
      if (incomingRank > existingRank) {
        map.set(k, { ...c, kolCount: Math.max(existing.kolCount, c.kolCount) })
      } else {
        existing.kolCount = Math.max(existing.kolCount, c.kolCount)
        if (!existing.name && c.name) existing.name = c.name
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const rankDiff = SOURCE_RANK[b.source] - SOURCE_RANK[a.source]
    if (rankDiff !== 0) return rankDiff
    return b.kolCount - a.kolCount
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('ticker') ?? searchParams.get('q') ?? ''
  const symbol = cleanTicker(raw)

  if (!symbol || symbol.length < 2 || symbol.length > 12 || !/^[A-Z0-9]+$/.test(symbol)) {
    return NextResponse.json(
      { query: raw, count: 0, results: [], error: 'invalid_ticker' },
      { status: 400 },
    )
  }

  const [curated, mentions] = await Promise.all([
    fetchCuratedHits(symbol),
    fetchMentionHits(symbol),
  ])

  // Only hit CoinGecko if we have nothing internal — saves 2 round-trips
  // and keeps the experience snappy on common tickers we've already curated.
  let coingecko: Candidate[] = []
  if (curated.length === 0 && mentions.length === 0) {
    coingecko = await fetchCoinGeckoHits(symbol)
  }

  const merged = mergeCandidates(curated, mentions, coingecko)

  return NextResponse.json(
    {
      query: symbol,
      count: merged.length,
      results: merged.slice(0, 8),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
      },
    },
  )
}
