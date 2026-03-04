import { NextResponse } from "next/server";

interface HoldersEntry { top10_pct: number | null; top1_pct: number | null; top3_pct: number | null; excluded_count: number; fetched_at: string; ts: number }
const cache = new Map<string, HoldersEntry>();
const TTL = 5 * 60_000;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mint = searchParams.get("mint")?.trim() ?? "";
  if (!mint) return NextResponse.json({ ok: false, reason: "missing mint" });

  const hit = cache.get(mint);
  if (hit && Date.now() - hit.ts < TTL)
    return NextResponse.json({ ok: true, chain: "SOL", mint, top10_pct: hit.top10_pct, top1_pct: hit.top1_pct, top3_pct: hit.top3_pct, excluded_count: hit.excluded_count, holders_source: "cache", fetched_at: hit.fetched_at, cache_hit: true });

  try {
    const res = await fetch(
      `https://public-api.solscan.io/token/holders?tokenAddress=${mint}&limit=10&offset=0`,
      { headers: { "User-Agent": "interligens/1.0" }, signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) throw new Error(`solscan ${res.status}`);
    const d = await res.json();
    const holders: any[] = d?.data ?? [];
    let top10_pct: number | null = null;
    if (holders.length > 0 && typeof d?.total === "number" && d.total > 0) {
      const top10 = holders.slice(0, 10).reduce((s: number, h: any) => s + Number(h.amount ?? 0), 0);
      top10_pct = Math.round((top10 / d.total) * 100 * 10) / 10;
    }
    const top1_pct = holders.length > 0 && d.total > 0 ? Math.round((Number(holders[0]?.amount ?? 0) / d.total) * 100 * 10) / 10 : null;
    const top3 = holders.slice(0, 3).reduce((acc: number, h: any) => acc + Number(h.amount ?? 0), 0);
    const top3_pct = holders.length > 0 && d.total > 0 ? Math.round((top3 / d.total) * 100 * 10) / 10 : null;
    const fetched_at = new Date().toISOString();
    cache.set(mint, { top10_pct, top1_pct, top3_pct, excluded_count: 0, fetched_at, ts: Date.now() });
    return NextResponse.json({ ok: true, chain: "SOL", mint, top10_pct, top1_pct, top3_pct, excluded_count: 0, holders_source: "solscan", fetched_at, cache_hit: false });
  } catch (e: any) {
    const fetched_at = new Date().toISOString();
    cache.set(mint, { top10_pct: null, top1_pct: null, top3_pct: null, excluded_count: 0, fetched_at, ts: Date.now() });
    return NextResponse.json({ ok: true, chain: "SOL", mint, top10_pct: null, top1_pct: null, top3_pct: null, excluded_count: 0, holders_source: "unavailable", fetched_at, cache_hit: false, reason: String(e?.message ?? "unavailable") });
  }
}
