// src/app/api/market/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,pax-gold&vs_currencies=usd&include_24hr_change=true'
const FNG_URL = 'https://api.alternative.me/fng/?limit=1'

// XAU is sourced via PAX Gold (pax-gold) — a CoinGecko-listed token where
// 1 PAXG = 1 troy ounce of LBMA gold, so its USD price tracks XAU spot.
interface PriceEntry {
  symbol: 'BTC' | 'ETH' | 'SOL' | 'XAU'
  usd: number | null
  change24h: number | null
}

interface FngEntry {
  value: number | null
  classification: string | null
}

async function fetchPrices(): Promise<PriceEntry[] | null> {
  try {
    const r = await fetch(COINGECKO_URL, {
      next: { revalidate: 300 },
      headers: { accept: 'application/json' },
    })
    if (!r.ok) return null
    const data = (await r.json()) as Record<string, { usd?: number; usd_24h_change?: number }>
    const gold = data['pax-gold']
    return [
      { symbol: 'BTC', usd: data.bitcoin?.usd ?? null, change24h: data.bitcoin?.usd_24h_change ?? null },
      { symbol: 'ETH', usd: data.ethereum?.usd ?? null, change24h: data.ethereum?.usd_24h_change ?? null },
      { symbol: 'SOL', usd: data.solana?.usd ?? null, change24h: data.solana?.usd_24h_change ?? null },
      { symbol: 'XAU', usd: gold?.usd ?? null, change24h: gold?.usd_24h_change ?? null },
    ]
  } catch {
    return null
  }
}

async function fetchFng(): Promise<FngEntry | null> {
  try {
    const r = await fetch(FNG_URL, {
      next: { revalidate: 300 },
      headers: { accept: 'application/json' },
    })
    if (!r.ok) return null
    const raw = (await r.json()) as {
      data?: { value?: string; value_classification?: string }[]
    }
    const entry = raw?.data?.[0]
    if (!entry) return null
    const v = entry.value != null ? parseInt(entry.value, 10) : NaN
    if (Number.isNaN(v)) return null
    return { value: v, classification: entry.value_classification ?? null }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.public)
  if (!rl.allowed) return rateLimitResponse(rl)

  const [pricesRes, fngRes] = await Promise.allSettled([fetchPrices(), fetchFng()])

  const prices = pricesRes.status === 'fulfilled' ? pricesRes.value : null
  const fng = fngRes.status === 'fulfilled' ? fngRes.value : null

  return NextResponse.json(
    {
      prices,
      fng,
      fetchedAt: new Date().toISOString(),
    },
    {
      headers: {
        // 5 min CDN cache, serve stale for 1 min while revalidating
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    },
  )
}
