/**
 * ENS reverse-lookup (free, no auth) via api.ensideas.com — a public ENS
 * resolver. Rate-limited by the provider; cached in ExternalLookupCache.
 *
 * Fallback strategy:
 *   - no-match → 6-hour negative TTL (new ENS registrations happen)
 *   - rate-limit → 15-minute backoff, no crash
 *   - provider down → SOURCE_UNAVAILABLE, never throws
 */

import { readCache, writeCache } from "./cache";

const SOURCE = "ens";
const PROVIDER_URL = "https://api.ensideas.com/ens/resolve";

export type EnsResult = {
  status: "HIT" | "NO_MATCH" | "ERROR" | "RATE_LIMITED";
  address: string;
  name: string | null;
  avatar: string | null;
  fetchedAt: string;
  cached: boolean;
};

export async function resolveEns(rawAddress: string): Promise<EnsResult> {
  const address = rawAddress.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    return {
      status: "NO_MATCH",
      address,
      name: null,
      avatar: null,
      fetchedAt: new Date().toISOString(),
      cached: false,
    };
  }

  const cached = await readCache(SOURCE, "address", address);
  if (cached) {
    const p = (cached.payload ?? {}) as { name?: string | null; avatar?: string | null };
    return {
      status: cached.status,
      address,
      name: p.name ?? null,
      avatar: p.avatar ?? null,
      fetchedAt: new Date().toISOString(),
      cached: true,
    };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${PROVIDER_URL}/${address}`, {
      headers: { "user-agent": "interligens-intel-lookup/1", accept: "application/json" },
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (res.status === 429) {
      await writeCache(SOURCE, "address", address, { status: "RATE_LIMITED", payload: null, errorCode: "429" });
      return {
        status: "RATE_LIMITED",
        address,
        name: null,
        avatar: null,
        fetchedAt: new Date().toISOString(),
        cached: false,
      };
    }
    if (!res.ok) {
      await writeCache(SOURCE, "address", address, {
        status: "ERROR",
        payload: null,
        errorCode: String(res.status),
      });
      return {
        status: "ERROR",
        address,
        name: null,
        avatar: null,
        fetchedAt: new Date().toISOString(),
        cached: false,
      };
    }
    const data = (await res.json()) as { name?: string | null; avatar?: string | null };
    const name = typeof data.name === "string" && data.name.length > 0 ? data.name : null;
    const avatar = typeof data.avatar === "string" ? data.avatar : null;

    const status: EnsResult["status"] = name ? "HIT" : "NO_MATCH";
    await writeCache(SOURCE, "address", address, {
      status,
      payload: { name, avatar },
      errorCode: null,
    });
    return {
      status,
      address,
      name,
      avatar,
      fetchedAt: new Date().toISOString(),
      cached: false,
    };
  } catch (err) {
    await writeCache(SOURCE, "address", address, {
      status: "ERROR",
      payload: null,
      errorCode: err instanceof Error ? err.name : "unknown",
    });
    return {
      status: "ERROR",
      address,
      name: null,
      avatar: null,
      fetchedAt: new Date().toISOString(),
      cached: false,
    };
  }
}
