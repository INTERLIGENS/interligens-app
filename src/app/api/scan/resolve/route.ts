// src/app/api/scan/resolve/route.ts
//
// Resolve a ticker symbol → a STABLE resolution envelope.
//
// Fallback order (never reordered):
//   curated (KolTokenLink) → mentions (KolPromotionMention) → DexScreener search
//   → CoinGecko search.
// DexScreener NEVER runs before the internal sources; CoinGecko runs ONLY when
// curated + mentions + DexScreener all come back empty.
//
// Response contract (front depends on this exact shape — see TokenPicker.tsx,
// fr/demo, en/demo):
//   {
//     status: "resolved" | "ambiguous" | "not_found",
//     query, selected, candidates, source, matchType,
//     // legacy compat (do not remove):
//     found, token, count, results
//   }
// status==="resolved" → found:true (front auto-scans `selected`).
// status==="ambiguous" → found:false; front shows a disambiguation dropdown.
// status==="not_found" → found:false; front shows the "nothing found" message.
//
// Read-only. No DB writes, no opportunistic upsert of DexScreener tokens.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  searchDexScreenerPairs,
  normalizeSymbol,
  tickerMatchType,
  compareResolveCandidates,
  decideResolution,
  type ResolvedTokenCandidate,
  type ResolveChain,
} from '@/lib/marketProviders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLATFORM_TO_CHAIN: Record<string, ResolveChain | undefined> = {
  ethereum: 'ETH',
  'binance-smart-chain': 'BSC',
  solana: 'SOL',
  tron: 'TRON',
  base: 'BASE',
  'arbitrum-one': 'ARBITRUM',
}

function normalizeChain(raw: string | null | undefined): ResolveChain | null {
  if (!raw) return null
  const c = raw.toUpperCase()
  if (c === 'SOL' || c === 'SOLANA') return 'SOL'
  if (c === 'ETH' || c === 'ETHEREUM') return 'ETH'
  if (c === 'BSC' || c === 'BNB' || c === 'BINANCE') return 'BSC'
  if (c === 'TRON' || c === 'TRX') return 'TRON'
  if (c === 'HYPER' || c === 'HYPERLIQUID') return 'HYPER'
  if (c === 'BASE') return 'BASE'
  if (c === 'ARBITRUM' || c === 'ARB' || c === 'ARBITRUM-ONE') return 'ARBITRUM'
  return null
}

function normalizeAddressForChain(addr: string, chain: ResolveChain): string {
  const trimmed = addr.trim()
  if (
    chain === 'ETH' ||
    chain === 'BSC' ||
    chain === 'HYPER' ||
    chain === 'BASE' ||
    chain === 'ARBITRUM'
  )
    return trimmed.toLowerCase()
  return trimmed
}

// Editorial seed rows sometimes use placeholders ("PENDING_OSINT_*") when the
// contract address is not yet on file. These must never be returned — scanning
// them would 500 the user. Real on-chain addresses are hex/base58 of length.
function isScanableAddress(addr: string, chain: ResolveChain): boolean {
  if (!addr) return false
  if (/^PENDING/i.test(addr) || /^TBD/i.test(addr) || /^TODO/i.test(addr)) return false
  if (
    chain === 'ETH' ||
    chain === 'BSC' ||
    chain === 'HYPER' ||
    chain === 'BASE' ||
    chain === 'ARBITRUM'
  )
    return /^0x[a-fA-F0-9]{40}$/.test(addr)
  if (chain === 'TRON') return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)
  if (chain === 'SOL') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)
  return false
}

function cleanTicker(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.replace(/^\$+/, '').toUpperCase().trim()
}

// Coarse SQL prefilter: any stored symbol that shares the query's first 4
// normalised chars is a candidate for exact OR prefix matching (both directions
// of our prefix rule require a shared 4-char head). For queries < 4 chars we
// only allow exact, so the prefix is the whole normalised query. tickerMatchType
// then does the precise, gated classification in JS.
function buildLikeArg(qn: string): string {
  const head = qn.length >= 4 ? qn.slice(0, 4) : qn
  return head + '%'
}

interface InternalRow {
  handle: string
  addr: string
  chain: string
  symbol: string | null
}

function buildInternalCandidates(
  rows: InternalRow[],
  query: string,
  source: 'curated' | 'mentions',
): ResolvedTokenCandidate[] {
  const qn = normalizeSymbol(query)
  const grouped = new Map<
    string,
    {
      addr: string
      chain: ResolveChain
      ticker: string
      handles: Set<string>
      matchType: ResolvedTokenCandidate['matchType']
    }
  >()
  for (const r of rows) {
    const chain = normalizeChain(r.chain)
    if (!chain) continue
    const addr = normalizeAddressForChain(r.addr, chain)
    if (!isScanableAddress(addr, chain)) continue
    const symRaw = r.symbol || query
    const matchType = tickerMatchType(qn, normalizeSymbol(symRaw))
    if (!matchType) continue
    const key = chain + ':' + addr.toLowerCase()
    const existing = grouped.get(key)
    if (existing) {
      existing.handles.add(r.handle.toLowerCase())
      // exact match on any contributing row wins for the group
      if (matchType === 'exact') existing.matchType = 'exact'
    } else {
      grouped.set(key, {
        addr,
        chain,
        ticker: cleanTicker(symRaw) || qn,
        handles: new Set([r.handle.toLowerCase()]),
        matchType,
      })
    }
  }
  return Array.from(grouped.values()).map(g => ({
    ticker: g.ticker,
    name: null,
    mint: g.addr,
    chain: g.chain,
    liquidityUsd: null,
    volume24hUsd: null,
    pairCreatedAt: null,
    source,
    matchType: g.matchType,
    lowLiquidity: false,
    kolCount: g.handles.size,
  }))
}

async function fetchCuratedHits(query: string): Promise<ResolvedTokenCandidate[]> {
  const likeArg = buildLikeArg(normalizeSymbol(query))
  const rows = await prisma.$queryRawUnsafe<
    Array<{ kolHandle: string; contractAddress: string; chain: string; tokenSymbol: string | null }>
  >(
    `SELECT "kolHandle", "contractAddress", "chain", "tokenSymbol"
       FROM "KolTokenLink"
      WHERE upper(regexp_replace(coalesce("tokenSymbol", ''), '[$[:space:]_-]', '', 'g')) LIKE $1`,
    likeArg,
  )
  return buildInternalCandidates(
    rows.map(r => ({ handle: r.kolHandle, addr: r.contractAddress, chain: r.chain, symbol: r.tokenSymbol })),
    query,
    'curated',
  )
}

async function fetchMentionHits(query: string): Promise<ResolvedTokenCandidate[]> {
  const likeArg = buildLikeArg(normalizeSymbol(query))
  const rows = await prisma.$queryRawUnsafe<
    Array<{ kolHandle: string; tokenMint: string; chain: string; tokenSymbol: string | null }>
  >(
    `SELECT "kolHandle", "tokenMint", "chain", "tokenSymbol"
       FROM "KolPromotionMention"
      WHERE upper(regexp_replace(coalesce("tokenSymbol", ''), '[$[:space:]_-]', '', 'g')) LIKE $1`,
    likeArg,
  )
  return buildInternalCandidates(
    rows.map(r => ({ handle: r.kolHandle, addr: r.tokenMint, chain: r.chain, symbol: r.tokenSymbol })),
    query,
    'mentions',
  )
}

// CoinGecko is the last-resort net: exact-symbol coins → contract addresses.
async function fetchCoinGeckoHits(symbol: string): Promise<ResolvedTokenCandidate[]> {
  try {
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
          return (await r.json()) as {
            id: string
            symbol: string
            name: string
            platforms?: Record<string, string>
          }
        } catch {
          return null
        }
      }),
    )

    const out: ResolvedTokenCandidate[] = []
    for (const detail of detailed) {
      if (!detail?.platforms) continue
      for (const [platform, addr] of Object.entries(detail.platforms)) {
        const chain = PLATFORM_TO_CHAIN[platform]
        if (!chain || !addr) continue
        const normalized = normalizeAddressForChain(addr, chain)
        if (!isScanableAddress(normalized, chain)) continue
        out.push({
          ticker: detail.symbol.toUpperCase(),
          name: detail.name,
          mint: normalized,
          chain,
          liquidityUsd: null,
          volume24hUsd: null,
          pairCreatedAt: null,
          source: 'coingecko',
          matchType: 'exact', // CoinGecko hits are exact-symbol filtered above
          lowLiquidity: false,
          kolCount: 0,
        })
      }
    }
    return out
  } catch {
    return []
  }
}

function dedupeByChainMint(list: ResolvedTokenCandidate[]): ResolvedTokenCandidate[] {
  const map = new Map<string, ResolvedTokenCandidate>()
  for (const c of list) {
    const key = c.chain + ':' + c.mint.toLowerCase()
    const existing = map.get(key)
    if (!existing) {
      map.set(key, c)
      continue
    }
    if (existing.matchType !== 'exact' && c.matchType === 'exact') existing.matchType = 'exact'
    existing.kolCount = Math.max(existing.kolCount ?? 0, c.kolCount ?? 0)
    if (!existing.name && c.name) existing.name = c.name
  }
  return Array.from(map.values())
}

// JSON shape: contract fields + legacy aliases (symbol/address) the demo pages
// still read via formatAddressForChain / handleTickerPick.
function serialize(c: ResolvedTokenCandidate) {
  return {
    ticker: c.ticker,
    name: c.name ?? null,
    mint: c.mint,
    chain: c.chain,
    liquidityUsd: c.liquidityUsd ?? null,
    volume24hUsd: c.volume24hUsd ?? null,
    pairCreatedAt: c.pairCreatedAt ?? null,
    source: c.source,
    matchType: c.matchType,
    lowLiquidity: !!c.lowLiquidity,
    kolCount: c.kolCount ?? 0,
    // legacy aliases — do not remove (fr/demo + en/demo)
    symbol: c.ticker,
    address: c.mint,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('ticker') ?? searchParams.get('q') ?? ''
  const symbol = cleanTicker(raw)

  if (!symbol || symbol.length < 2 || symbol.length > 12 || !/^[A-Z0-9]+$/.test(symbol)) {
    return NextResponse.json(
      {
        status: 'not_found' as const,
        query: raw,
        selected: null,
        candidates: [],
        source: null,
        matchType: null,
        error: 'invalid_ticker',
        found: false,
        token: null,
        count: 0,
        results: [],
      },
      { status: 400 },
    )
  }

  // Tier 1 + 2: internal sources, in parallel. They always run first.
  const [curated, mentions] = await Promise.all([fetchCuratedHits(symbol), fetchMentionHits(symbol)])
  console.log(`[resolve] q=${symbol} tier=internal curated=${curated.length} mentions=${mentions.length}`)

  let candidates: ResolvedTokenCandidate[] = []
  let coverage = ''

  const internal = dedupeByChainMint([...curated, ...mentions])
  if (internal.length > 0) {
    candidates = internal
    coverage = 'internal'
  } else {
    // Tier 3: DexScreener. Only reached when internal is empty.
    console.log(`[resolve] q=${symbol} tier=dexscreener CALLED (internal empty)`)
    const dex = await searchDexScreenerPairs(symbol)
    console.log(`[resolve] q=${symbol} tier=dexscreener hits=${dex.length}`)
    if (dex.length > 0) {
      candidates = dedupeByChainMint(dex)
      coverage = 'dexscreener'
    } else {
      // Tier 4: CoinGecko. Only reached when internal AND DexScreener empty.
      console.log(`[resolve] q=${symbol} tier=coingecko CALLED (internal+dexscreener empty)`)
      const cg = await fetchCoinGeckoHits(symbol)
      console.log(`[resolve] q=${symbol} tier=coingecko hits=${cg.length}`)
      candidates = dedupeByChainMint(cg)
      coverage = 'coingecko'
    }
  }

  const sorted = candidates.slice().sort(compareResolveCandidates)
  const status = decideResolution(sorted)
  const selected = sorted[0] ?? null
  const top = sorted[0]

  console.log(
    `[resolve] q=${symbol} coverage=${coverage} count=${sorted.length} status=${status} ` +
      `topSource=${top?.source ?? 'none'} topMatch=${top?.matchType ?? 'none'}`,
  )

  const serializedCandidates = sorted.slice(0, 8).map(serialize)
  const serializedSelected = selected ? serialize(selected) : null

  return NextResponse.json(
    {
      status,
      query: symbol,
      selected: serializedSelected,
      candidates: serializedCandidates,
      source: top?.source ?? null,
      matchType: top?.matchType ?? null,
      // legacy compat
      found: status === 'resolved',
      token: serializedSelected,
      count: sorted.length,
      results: serializedCandidates,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
      },
    },
  )
}
