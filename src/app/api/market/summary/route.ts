import { NextRequest, NextResponse } from "next/server";
import { getMarketSnapshot } from "@/lib/marketProviders";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chain = (searchParams.get("chain") ?? "solana") as "solana";
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing ?token=" }, { status: 400 });

  const snap = await getMarketSnapshot(chain, token);

  return NextResponse.json({
    chain,
    token,
    price_usd: snap.price,
    liquidity_usd: snap.liquidity_usd,
    volume_24h_usd: snap.volume_24h_usd,
    fdv_usd: snap.fdv_usd,
    pool_address: snap.primary_pool,
    pair_age_days: snap.pair_age_days ?? null,
    source: snap.source,
    url: snap.url,
    fetched_at: snap.fetched_at,
    cache_hit: snap.cache_hit,
    data_unavailable: snap.data_unavailable ?? false,
    reason: snap.reason,
  });
}
