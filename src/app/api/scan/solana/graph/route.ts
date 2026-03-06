// src/app/api/scan/solana/graph/route.ts
import { NextRequest, NextResponse } from "next/server";
import { buildGraphReport } from "@/lib/solanaGraph/engine";
import type { HopsDepth, DaysWindow } from "@/lib/solanaGraph/types";

import { vaultLookup } from "@/lib/vault/vaultLookup";
import { checkScanLimit } from "@/lib/vault/scanRateLimit";
import { auditScanLookup } from "@/lib/vault/auditScan";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Cache TTL 30min (mémoire process) ────────────────────────────────────────
const _cache = new Map<string, { expiresAt: number; value: unknown }>();
function cacheGet(key: string): unknown | null {
  const e = _cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { _cache.delete(key); return null; }
  return e.value;
}
function cacheSet(key: string, value: unknown, ttlMs = 30 * 60 * 1000) {
  _cache.set(key, { expiresAt: Date.now() + ttlMs, value });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mint   = sp.get("mint")   ?? undefined;
  const wallet = sp.get("wallet") ?? undefined;
  if (!mint && !wallet)
    return NextResponse.json({ error: "Missing mint or wallet" }, { status: 400 });

  const hops: HopsDepth = sp.get("hops") === "2" ? 2 : 1;
  const daysRaw = Number(sp.get("days") ?? 30);
  const days: DaysWindow = daysRaw === 14 ? 14 : daysRaw === 90 ? 90 : 30;

  const key = `graph:${mint ?? wallet}:h${hops}:d${days}`;
  const t0  = Date.now();

  // Cache hit ?
  const cached = cacheGet(key);
  if (cached) {
    const ms = Date.now() - t0;
    console.log("[graph]", { cache_hit: true, key, ms });
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT", "Cache-Control": "no-store" },
    });
  }

  try {
    const report = await buildGraphReport(mint, wallet, hops, days);
    cacheSet(key, report);
    const ms = Date.now() - t0;
    console.log("[graph]", { cache_hit: false, key, ms });
    return NextResponse.json(report, {
      headers: {
        "X-Cache": report.cache_hit ? "HIT" : "MISS",
        "X-Graph-Status": report.overall_status,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Graph computation failed" },
      { status: 500 }
    );
  }
}
