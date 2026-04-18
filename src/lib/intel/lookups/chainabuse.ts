/**
 * Chainabuse on-demand lookup — SKELETON.
 *
 * Enable by setting CHAINABUSE_API_KEY in Vercel env. Without the key this
 * returns SOURCE_UNAVAILABLE cleanly so the orchestrator never blocks.
 *
 * IMPORTANT: Chainabuse ToS restricts bulk ingest. Keep this strictly on-
 * demand, with cache, for investigator-driven lookups only.
 */

import { readCache, writeCache } from "./cache";

const SOURCE = "chainabuse";
const API_BASE = "https://api.chainabuse.com/v0";

export type ChainabuseResult = {
  status: "HIT" | "NO_MATCH" | "ERROR" | "RATE_LIMITED" | "SOURCE_UNAVAILABLE";
  address: string;
  reportCount: number;
  categories: string[];
  cached: boolean;
};

export async function lookupChainabuse(rawAddress: string): Promise<ChainabuseResult> {
  const key = process.env.CHAINABUSE_API_KEY;
  const address = rawAddress.trim().toLowerCase();
  if (!key) {
    return {
      status: "SOURCE_UNAVAILABLE",
      address,
      reportCount: 0,
      categories: [],
      cached: false,
    };
  }

  const cached = await readCache(SOURCE, "address", address);
  if (cached) {
    const p = (cached.payload ?? {}) as { reportCount?: number; categories?: string[] };
    return {
      status: cached.status as ChainabuseResult["status"],
      address,
      reportCount: p.reportCount ?? 0,
      categories: p.categories ?? [],
      cached: true,
    };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${API_BASE}/reports/address/${address}`, {
      headers: { authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`, accept: "application/json" },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (res.status === 429) {
      await writeCache(SOURCE, "address", address, { status: "RATE_LIMITED", payload: null, errorCode: "429" });
      return { status: "RATE_LIMITED", address, reportCount: 0, categories: [], cached: false };
    }
    if (!res.ok) {
      await writeCache(SOURCE, "address", address, { status: "ERROR", payload: null, errorCode: String(res.status) });
      return { status: "ERROR", address, reportCount: 0, categories: [], cached: false };
    }
    const data = (await res.json()) as { reports?: Array<{ category?: string }>; };
    const reportCount = data.reports?.length ?? 0;
    const categories = [...new Set((data.reports ?? []).map((r) => r.category).filter(Boolean) as string[])];
    const status: ChainabuseResult["status"] = reportCount > 0 ? "HIT" : "NO_MATCH";
    await writeCache(SOURCE, "address", address, { status, payload: { reportCount, categories }, errorCode: null });
    return { status, address, reportCount, categories, cached: false };
  } catch (err) {
    await writeCache(SOURCE, "address", address, {
      status: "ERROR",
      payload: null,
      errorCode: err instanceof Error ? err.name : "unknown",
    });
    return { status: "ERROR", address, reportCount: 0, categories: [], cached: false };
  }
}
