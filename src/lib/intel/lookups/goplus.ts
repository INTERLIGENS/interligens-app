/**
 * GoPlus Security on-demand address lookup — SKELETON.
 *
 * Public tier uses https://api.gopluslabs.io/api/v1/address_security/{addr}
 * without a key at low request rates. When GOPLUS_API_KEY is set, the token
 * is attached to raise the rate-limit. Either way, cache is authoritative.
 */

import { readCache, writeCache } from "./cache";

const SOURCE = "goplus";
const API_BASE = "https://api.gopluslabs.io/api/v1/address_security";

export type GoPlusResult = {
  status: "HIT" | "NO_MATCH" | "ERROR" | "RATE_LIMITED";
  address: string;
  chainId: string;
  flags: Record<string, string>;
  cached: boolean;
};

export async function lookupGoPlus(rawAddress: string, chainId = "1"): Promise<GoPlusResult> {
  const address = rawAddress.trim().toLowerCase();
  const cacheKey = `${chainId}:${address}`;
  const cached = await readCache(SOURCE, "address", cacheKey);
  if (cached) {
    const p = (cached.payload ?? {}) as { flags?: Record<string, string> };
    return {
      status: cached.status as GoPlusResult["status"],
      address,
      chainId,
      flags: p.flags ?? {},
      cached: true,
    };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": "interligens-intel-lookup/1",
    };
    if (process.env.GOPLUS_API_KEY) {
      headers.authorization = process.env.GOPLUS_API_KEY;
    }
    const res = await fetch(`${API_BASE}/${address}?chain_id=${chainId}`, { headers, signal: ctrl.signal });
    clearTimeout(timer);
    if (res.status === 429) {
      await writeCache(SOURCE, "address", cacheKey, { status: "RATE_LIMITED", payload: null, errorCode: "429" });
      return { status: "RATE_LIMITED", address, chainId, flags: {}, cached: false };
    }
    if (!res.ok) {
      await writeCache(SOURCE, "address", cacheKey, { status: "ERROR", payload: null, errorCode: String(res.status) });
      return { status: "ERROR", address, chainId, flags: {}, cached: false };
    }
    const body = (await res.json()) as { result?: Record<string, Record<string, string>> };
    const inner = body.result?.[address] ?? {};
    const interesting = Object.entries(inner)
      .filter(([, v]) => v === "1")
      .reduce<Record<string, string>>((acc, [k, v]) => { acc[k] = v; return acc; }, {});
    const hit = Object.keys(interesting).some((k) =>
      k.includes("malicious") || k.includes("phishing") || k.includes("blacklist") || k.includes("sanction")
    );
    const status: GoPlusResult["status"] = hit ? "HIT" : "NO_MATCH";
    await writeCache(SOURCE, "address", cacheKey, { status, payload: { flags: interesting }, errorCode: null });
    return { status, address, chainId, flags: interesting, cached: false };
  } catch (err) {
    await writeCache(SOURCE, "address", cacheKey, {
      status: "ERROR",
      payload: null,
      errorCode: err instanceof Error ? err.name : "unknown",
    });
    return { status: "ERROR", address, chainId, flags: {}, cached: false };
  }
}
