import { NextResponse } from "next/server";

const cache = new Map<string, { price: number; change: number; ts: number }>();
const TTL = 60_000;
export const dynamic = "force-dynamic";

export async function GET() {
  const hit = cache.get("btc");
  if (hit && Date.now() - hit.ts < TTL)
    return NextResponse.json({ price: hit.price, change: hit.change, source: "cache" });
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
      { cache: "no-store" }
    );
    const data = await res.json();
    const price: number = data?.bitcoin?.usd ?? 0;
    const change: number = data?.bitcoin?.usd_24h_change ?? 0;
    if (price) cache.set("btc", { price, change, ts: Date.now() });
    return NextResponse.json({ price, change });
  } catch {
    return NextResponse.json({ price: null, change: null, source: "error" });
  }
}
