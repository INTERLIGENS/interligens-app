/**
 * Retail Vision Phase 6C — Bubblemaps adapter.
 *
 * Fail-soft client for bubblemaps.io public API. Returns top holders with
 * wallet-to-wallet edge info (if available), plus cross-reference against
 * known KolWallets.
 *
 * Endpoints (public, no key required for /v1/map-data):
 *   GET https://api-legacy.bubblemaps.io/map-data?token={address}&chain={chain}
 *
 * Chain mapping per Bubblemaps docs:
 *   SOL → "sol", ETH → "eth", BSC → "bsc"
 *
 * Cache: 1h in-memory per (chain,address). No persistence; per-process only.
 *
 * NB: Bubblemaps updated their public endpoint over time. We try the modern
 * path first and fall back. All failures return an empty result with an
 * `error` string — callers must fail-soft.
 */

export type BubblemapsChain = "sol" | "eth" | "bsc";

export interface BubblemapsHolder {
  address: string;
  pct: number;
  name?: string | null;
  isContract?: boolean;
  isExchange?: boolean;
}

export interface BubblemapsLink {
  from: string;
  to: string;
  forward?: number;
  backward?: number;
}

export interface BubblemapsResult {
  chain: BubblemapsChain;
  address: string;
  source: string;
  top: BubblemapsHolder[];
  links: BubblemapsLink[];
  fetchedAt: string;
  error?: string;
}

export interface CoordinationSignal {
  chain: BubblemapsChain;
  address: string;
  kolWalletsInTop10: Array<{
    walletAddress: string;
    kolHandle: string;
    rank: number;
    pct: number;
  }>;
  top10Pct: number;
  linked: boolean;
}

const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  value: BubblemapsResult;
}

const cache = new Map<string, CacheEntry>();

export function mapChain(raw: string): BubblemapsChain | null {
  const s = (raw || "").toUpperCase();
  if (s === "SOL" || s === "SOLANA") return "sol";
  if (s === "ETH" || s === "ETHEREUM") return "eth";
  if (s === "BSC" || s === "BNB" || s === "BINANCE") return "bsc";
  return null;
}

function cacheKey(chain: BubblemapsChain, address: string): string {
  return `${chain}:${address.toLowerCase()}`;
}

interface MapDataResponse {
  version?: number;
  chain?: string;
  token_address?: string;
  dt_update?: string;
  full_name?: string;
  symbol?: string;
  is_X721?: boolean;
  metadata?: { max_amount?: number; min_amount?: number };
  nodes?: Array<{
    address: string;
    amount?: number;
    is_contract?: boolean;
    name?: string | null;
    percentage?: number;
    transaction_count?: number;
  }>;
  links?: Array<{
    source: number;
    target: number;
    backward?: number;
    forward?: number;
  }>;
  token_links?: Array<{
    source: number;
    target: number;
    backward?: number;
    forward?: number;
  }>;
}

async function fetchJson(url: string, timeoutMs = 10_000): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchBubblemaps(
  chain: BubblemapsChain,
  address: string
): Promise<BubblemapsResult> {
  const key = cacheKey(chain, address);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const base: BubblemapsResult = {
    chain,
    address,
    source: "bubblemaps.io/map-data",
    top: [],
    links: [],
    fetchedAt: new Date().toISOString(),
  };

  const urls = [
    `https://api-legacy.bubblemaps.io/map-data?token=${encodeURIComponent(address)}&chain=${chain}`,
    `https://api.bubblemaps.io/v1/token/${chain}/${encodeURIComponent(address)}/map`,
  ];

  let data: MapDataResponse | null = null;
  for (const url of urls) {
    const j = (await fetchJson(url)) as MapDataResponse | null;
    if (j && (j.nodes || j.token_links)) {
      data = j;
      break;
    }
  }

  if (!data || !Array.isArray(data.nodes)) {
    const result = { ...base, error: "bubblemaps: no data" };
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
    return result;
  }

  const top: BubblemapsHolder[] = data.nodes
    .map((n) => ({
      address: (n.address || "").toLowerCase(),
      pct: typeof n.percentage === "number" ? roundPct(n.percentage) : 0,
      name: n.name ?? null,
      isContract: Boolean(n.is_contract),
      isExchange: false,
    }))
    .filter((h) => h.address && h.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 50);

  const rawLinks = data.token_links ?? data.links ?? [];
  const links: BubblemapsLink[] = [];
  for (const l of rawLinks) {
    const from = data.nodes?.[l.source]?.address?.toLowerCase();
    const to = data.nodes?.[l.target]?.address?.toLowerCase();
    if (!from || !to) continue;
    links.push({ from, to, forward: l.forward, backward: l.backward });
  }

  const result: BubblemapsResult = { ...base, top, links };
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
  return result;
}

function roundPct(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Cross-reference top-10 holders with a provided KolWallet set.
 * `kolWallets` is a map from lowercased wallet address → kolHandle.
 */
export function findKolWalletsInTop10(
  result: BubblemapsResult,
  kolWallets: Map<string, string>
): CoordinationSignal {
  const top10 = result.top.slice(0, 10);
  const hits = top10
    .map((h, i) => {
      const handle = kolWallets.get(h.address);
      if (!handle) return null;
      return { walletAddress: h.address, kolHandle: handle, rank: i + 1, pct: h.pct };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const top10Pct = top10.reduce((s, h) => s + h.pct, 0);
  const addrSet = new Set(top10.map((h) => h.address));
  const linked = result.links.some(
    (l) => addrSet.has(l.from) && addrSet.has(l.to) && l.from !== l.to
  );

  return {
    chain: result.chain,
    address: result.address,
    kolWalletsInTop10: hits,
    top10Pct: roundPct(top10Pct),
    linked,
  };
}

export function __clearBubblemapsCache(): void {
  cache.clear();
}
