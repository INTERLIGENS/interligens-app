/**
 * Generic TTL cache over ExternalLookupCache. All lookups share this.
 * Negative results get a shorter TTL so we retry sooner; positive results
 * stay longer to minimise upstream load.
 */

import { prisma } from "@/lib/prisma";

type CacheEntry = {
  status: "HIT" | "NO_MATCH" | "ERROR" | "RATE_LIMITED";
  payload: unknown;
  errorCode: string | null;
};

const DEFAULT_HIT_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const DEFAULT_NEG_TTL_MS = 1000 * 60 * 60 * 6;       // 6 hours
const DEFAULT_ERR_TTL_MS = 1000 * 60 * 15;           // 15 minutes

export async function readCache(
  source: string,
  queryType: string,
  queryKey: string,
): Promise<CacheEntry | null> {
  try {
    const row = await prisma.externalLookupCache.findUnique({
      where: { source_queryType_queryKey: { source, queryType, queryKey } },
    });
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) return null;
    return {
      status: row.status as CacheEntry["status"],
      payload: row.payload,
      errorCode: row.errorCode,
    };
  } catch {
    return null;
  }
}

export async function writeCache(
  source: string,
  queryType: string,
  queryKey: string,
  entry: CacheEntry,
  customTtlMs?: number,
): Promise<void> {
  const ttl =
    customTtlMs ??
    (entry.status === "HIT"
      ? DEFAULT_HIT_TTL_MS
      : entry.status === "NO_MATCH"
        ? DEFAULT_NEG_TTL_MS
        : DEFAULT_ERR_TTL_MS);
  const expiresAt = new Date(Date.now() + ttl);
  try {
    await prisma.externalLookupCache.upsert({
      where: { source_queryType_queryKey: { source, queryType, queryKey } },
      update: {
        status: entry.status,
        payload: (entry.payload ?? null) as never,
        errorCode: entry.errorCode,
        fetchedAt: new Date(),
        expiresAt,
      },
      create: {
        source,
        queryType,
        queryKey,
        status: entry.status,
        payload: (entry.payload ?? null) as never,
        errorCode: entry.errorCode,
        expiresAt,
      },
    });
  } catch (err) {
    console.warn("[external-cache] write failed", source, queryKey, err);
  }
}
