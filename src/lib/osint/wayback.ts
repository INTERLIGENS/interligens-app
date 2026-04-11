/**
 * Retail Vision Phase 6F-4 — Wayback Machine (archive.org) OSINT client.
 *
 * Investigator-only: exposes search + oldest-capture lookups against
 * the Wayback CDX API. No automation, no cron — used behind the admin
 * route to look up deleted project pages, ambassador lists, wiped proofs.
 *
 * CDX API:
 *   GET http://web.archive.org/cdx/search/cdx
 *     ?url=...&output=json&limit=20&fl=timestamp,original,statuscode
 *
 * The response is a JSON array of arrays; the first row is headers.
 * We flatten it into objects for easier consumption. Fail-soft on any
 * error: returns empty array, no throw.
 */

export interface WaybackCapture {
  timestamp: string;
  original: string;
  statusCode: string | null;
  snapshotUrl: string;
}

const CDX_BASE = "http://web.archive.org/cdx/search/cdx";

function snapshotUrl(timestamp: string, original: string): string {
  return `https://web.archive.org/web/${timestamp}/${original}`;
}

export async function searchArchivedPage(
  url: string,
  limit = 20
): Promise<WaybackCapture[]> {
  if (!url) return [];
  const qs = new URLSearchParams({
    url,
    output: "json",
    limit: String(Math.min(Math.max(limit, 1), 100)),
    fl: "timestamp,original,statuscode",
  });

  let res: Response;
  try {
    res = await fetch(`${CDX_BASE}?${qs.toString()}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return [];
  }
  if (!Array.isArray(data) || data.length <= 1) return [];

  // First row is the header ["timestamp","original","statuscode"]
  const rows = data.slice(1) as unknown[];
  const out: WaybackCapture[] = [];
  for (const r of rows) {
    if (!Array.isArray(r) || r.length < 2) continue;
    const timestamp = typeof r[0] === "string" ? r[0] : null;
    const original = typeof r[1] === "string" ? r[1] : null;
    const statusCode = r[2] != null ? String(r[2]) : null;
    if (!timestamp || !original) continue;
    out.push({
      timestamp,
      original,
      statusCode,
      snapshotUrl: snapshotUrl(timestamp, original),
    });
  }
  return out;
}

export async function getOldestCapture(url: string): Promise<WaybackCapture | null> {
  const captures = await searchArchivedPage(url, 100);
  if (captures.length === 0) return null;
  // CDX returns chronological order by default; oldest first.
  return captures[0];
}
