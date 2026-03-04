import { NextResponse } from "next/server";

interface CacheEntry { price_usd: number; change_24h_pct: number; fetched_at: string; ts: number }
const cache = new Map<string, CacheEntry>();
const TTL = 60_000;
export const dynamic = "force-dynamic";

export async function GET() {
  const hit = cache.get("btc");
  if (hit && Date.now() - hit.ts < TTL)
    return NextResponse.json({ ok: true, price_usd: hit.price_usd, change_24h_pct: hit.change_24h_pct, fetched_at: hit.fetched_at, source: "cache" });
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
      { cache: "no-store" }
    );
    const data = await res.json();
    const price_usd: number = data?.bitcoin?.usd ?? 0;
    const change_24h_pct: number = data?.bitcoin?.usd_24h_change ?? 0;
    if (!price_usd) throw new Error("empty");
    const fetched_at = new Date().toISOString();
    cache.set("btc", { price_usd, change_24h_pct, fetched_at, ts: Date.now() });
    return NextResponse.json({ ok: true, price_usd, change_24h_pct, fetched_at });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
