/**
 * Retail Vision Phase 6F-1 — RugCheck adapter.
 *
 * Fail-soft client for rugcheck.xyz public API.
 *
 *   GET https://api.rugcheck.xyz/v1/tokens/{mint}/report
 *
 * Normalized output captures what we need downstream:
 *   - global risk score (0-100)
 *   - list of risks (mint/freeze authority, LP locks, tax, etc.)
 *   - insider wallets (bought before public launch)
 *   - deployer/creator address
 *   - historyTokens: other tokens deployed by that creator, with status
 *   - SERIAL_RUGGER flag: creator has >= 2 tokens previously rugged
 *
 * All errors → empty result with `error` string. Never throws.
 */

export interface RugCheckRisk {
  name: string;
  level?: string | null;
  description?: string | null;
  value?: string | null;
  score?: number | null;
}

export interface RugCheckInsider {
  address: string;
  amount?: number | null;
  pct?: number | null;
}

export interface RugCheckCreatorHistoryToken {
  mint: string;
  status: string | null;
  createdAt?: string | null;
}

export interface RugCheckResult {
  mint: string;
  source: string;
  score: number | null;
  risks: RugCheckRisk[];
  insiders: RugCheckInsider[];
  creator: string | null;
  creatorHistory: RugCheckCreatorHistoryToken[];
  isSerialRugger: boolean;
  rawScore: number | null;
  fetchedAt: string;
  raw?: unknown;
  error?: string;
}

interface RugCheckRawReport {
  score?: number;
  score_normalised?: number;
  risks?: Array<{
    name?: string;
    level?: string;
    description?: string;
    value?: string;
    score?: number;
  }>;
  creator?: string;
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  token?: { mintAuthority?: string | null; freezeAuthority?: string | null };
  insiderNetworks?: Array<{
    wallets?: Array<{ address?: string; amount?: number; pct?: number }>;
    size?: number;
  }>;
  creatorTokens?: Array<{
    mint?: string;
    createdAt?: string;
    status?: string;
  }>;
}

const EMPTY_RESULT = (mint: string, error?: string): RugCheckResult => ({
  mint,
  source: "rugcheck.xyz/v1",
  score: null,
  risks: [],
  insiders: [],
  creator: null,
  creatorHistory: [],
  isSerialRugger: false,
  rawScore: null,
  fetchedAt: new Date().toISOString(),
  error,
});

export async function fetchRugCheck(mint: string): Promise<RugCheckResult> {
  if (!mint) return EMPTY_RESULT(mint, "empty mint");

  const url = `https://api.rugcheck.xyz/v1/tokens/${encodeURIComponent(mint)}/report`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
  } catch (e) {
    return EMPTY_RESULT(mint, `fetch failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) return EMPTY_RESULT(mint, `http ${res.status}`);

  let data: RugCheckRawReport;
  try {
    data = (await res.json()) as RugCheckRawReport;
  } catch {
    return EMPTY_RESULT(mint, "invalid json");
  }

  const rawScore = typeof data.score === "number" ? data.score : null;
  // RugCheck returns a cumulative risk score — rough normalisation to 0..100.
  // score_normalised (if present) is already in 0..100 scale.
  const score =
    typeof data.score_normalised === "number"
      ? Math.max(0, Math.min(100, Math.round(data.score_normalised)))
      : rawScore != null
        ? Math.max(0, Math.min(100, Math.round(rawScore)))
        : null;

  const risks: RugCheckRisk[] = Array.isArray(data.risks)
    ? data.risks.map((r) => ({
        name: r.name ?? "unknown",
        level: r.level ?? null,
        description: r.description ?? null,
        value: r.value ?? null,
        score: typeof r.score === "number" ? r.score : null,
      }))
    : [];

  const insiders: RugCheckInsider[] = [];
  if (Array.isArray(data.insiderNetworks)) {
    for (const net of data.insiderNetworks) {
      if (!Array.isArray(net.wallets)) continue;
      for (const w of net.wallets) {
        if (!w.address) continue;
        insiders.push({
          address: w.address,
          amount: typeof w.amount === "number" ? w.amount : null,
          pct: typeof w.pct === "number" ? w.pct : null,
        });
      }
    }
  }

  const creator = typeof data.creator === "string" ? data.creator : null;

  const creatorHistory: RugCheckCreatorHistoryToken[] = Array.isArray(data.creatorTokens)
    ? data.creatorTokens
        .filter((t) => typeof t.mint === "string")
        .map((t) => ({
          mint: t.mint as string,
          status: typeof t.status === "string" ? t.status : null,
          createdAt: typeof t.createdAt === "string" ? t.createdAt : null,
        }))
    : [];

  const ruggedCount = creatorHistory.filter((t) =>
    /rug|scam|dead|rugged/i.test(t.status ?? "")
  ).length;
  const isSerialRugger = ruggedCount >= 2;

  return {
    mint,
    source: "rugcheck.xyz/v1",
    score,
    risks,
    insiders,
    creator,
    creatorHistory,
    isSerialRugger,
    rawScore,
    fetchedAt: new Date().toISOString(),
    raw: data,
  };
}

export function hasInsiders(result: RugCheckResult): boolean {
  return result.insiders.length > 0;
}
