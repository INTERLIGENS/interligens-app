import { NextResponse } from "next/server";

interface Coin { price_usd: number; change_24h_pct: number }
interface CacheEntry { btc: Coin; eth: Coin; sol: Coin; fetched_at: string; ts: number }
const cache = new Map<string, CacheEntry>();
const TTL = 60_000;
export const dynamic = "force-dynamic";

export async function GET() {
  const hit = cache.get("tickers");
  if (hit && Date.now() - hit.ts < TTL)
    return NextResponse.json({ ok: true, source: "cache", fetched_at: hit.fetched_at, btc: hit.btc, eth: hit.eth, sol: hit.sol });
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true",
      { cache: "no-store" }
    );
    const d = await res.json();
    const coin = (id: string): Coin => ({
      price_usd: d?.[id]?.usd ?? 0,
      change_24h_pct: d?.[id]?.usd_24h_change ?? 0,
    });
    const btc = coin("bitcoin");
    const eth = coin("ethereum");
    const sol = coin("solana");
    if (!btc.price_usd) throw new Error("empty");
    const fetched_at = new Date().toISOString();
    cache.set("tickers", { btc, eth, sol, fetched_at, ts: Date.now() });
    return NextResponse.json({ ok: true, source: "coingecko", fetched_at, btc, eth, sol });
  } catch {
    return NextResponse.json({ ok: false, source: "fail" });
  }
}
