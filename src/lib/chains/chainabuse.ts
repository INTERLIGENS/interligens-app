/**
 * Retail Vision Phase 6D — Chainabuse reports adapter.
 *
 * Fetches victim reports from chainabuse.com for a given on-chain address.
 * Fail-soft client: any network, parsing, or schema mismatch returns a clean
 * empty result. The consumer never throws.
 *
 * EDITORIAL RULE — ABSOLUTE:
 *   Chainabuse is an INTERNAL SIGNAL ONLY.
 *   Never surface a Chainabuse-sourced label to retail UI without an
 *   independent on-chain corroboration (funding edge, front-run, etc.).
 *   All evidence rows written from this source MUST carry
 *   `displaySafety = "INTERNAL_ONLY"`.
 *
 * Source format: public JSON endpoint, unauthenticated.
 *   GET https://www.chainabuse.com/api/reports?address={address}
 *
 * The response schema is loosely documented and varies; we coerce the
 * parts we care about (count, categories, firstSeen, lastSeen) and keep
 * the raw JSON for forensic review.
 */

export interface ChainabuseReport {
  category?: string | null;
  reportedAt?: string | null;
  summary?: string | null;
}

export interface ChainabuseResult {
  address: string;
  source: string;
  reportCount: number;
  categories: string[];
  firstSeen: string | null;
  lastSeen: string | null;
  reports: ChainabuseReport[];
  fetchedAt: string;
  error?: string;
}

interface RawReportsResponse {
  reports?: unknown[];
  data?: unknown[];
  results?: unknown[];
  count?: number;
  total?: number;
}

const USER_AGENT = "InterLigens-RetailVision/1.0 (+retail-protection; contact: @david)";

function emptyResult(address: string, error?: string): ChainabuseResult {
  return {
    address,
    source: "chainabuse.com/api/reports",
    reportCount: 0,
    categories: [],
    firstSeen: null,
    lastSeen: null,
    reports: [],
    fetchedAt: new Date().toISOString(),
    error,
  };
}

export async function fetchChainabuseReports(
  address: string
): Promise<ChainabuseResult> {
  if (!address) return emptyResult(address, "empty address");

  const url = `https://www.chainabuse.com/api/reports?address=${encodeURIComponent(address)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    return emptyResult(address, `fetch failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!res.ok) return emptyResult(address, `http ${res.status}`);

  let json: RawReportsResponse;
  try {
    json = (await res.json()) as RawReportsResponse;
  } catch {
    return emptyResult(address, "invalid json");
  }

  const raw = Array.isArray(json.reports)
    ? json.reports
    : Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.results)
        ? json.results
        : [];

  const reports: ChainabuseReport[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const category =
      typeof r.category === "string"
        ? r.category
        : typeof r.scamCategory === "string"
          ? r.scamCategory
          : null;
    const reportedAt =
      typeof r.createdAt === "string"
        ? r.createdAt
        : typeof r.reportedAt === "string"
          ? r.reportedAt
          : null;
    const summary =
      typeof r.description === "string" ? r.description.slice(0, 280) : null;
    reports.push({ category, reportedAt, summary });
  }

  const categories = Array.from(
    new Set(
      reports
        .map((r) => r.category)
        .filter((c): c is string => typeof c === "string" && c.length > 0)
    )
  );

  const timestamps = reports
    .map((r) => (r.reportedAt ? new Date(r.reportedAt).getTime() : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  return {
    address,
    source: "chainabuse.com/api/reports",
    reportCount: reports.length || Number(json.count ?? json.total ?? 0) || 0,
    categories,
    firstSeen: timestamps.length ? new Date(timestamps[0]).toISOString() : null,
    lastSeen: timestamps.length ? new Date(timestamps[timestamps.length - 1]).toISOString() : null,
    reports,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Validity threshold per brief: >= 3 reports is considered actionable
 * (as an INTERNAL signal only — see editorial rule at top of file).
 */
export function isActionable(result: ChainabuseResult): boolean {
  return !result.error && result.reportCount >= 3;
}
