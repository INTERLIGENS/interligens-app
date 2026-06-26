export type MarketSnapshot = {
  source: "geckoterminal" | "dexscreener" | null;
  primary_pool: string | null;
  dex: string | null;
  url: string | null;
  price: number | null;
  liquidity_usd: number | null;
  volume_24h_usd: number | null;
  fdv_usd: number | null;
  pair_age_days: number | null;
  fetched_at: string;
  cache_hit: boolean;
  data_unavailable: boolean;
  reason?: string;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
type CacheEntry = { snapshot: MarketSnapshot; expires_at: number };
const _cache = new Map<string, CacheEntry>();

function cacheKey(chain: string, mint: string) {
  return `${chain}:${mint}`;
}

function getCached(chain: string, mint: string): MarketSnapshot | null {
  const entry = _cache.get(cacheKey(chain, mint));
  if (!entry) return null;
  if (Date.now() > entry.expires_at) {
    _cache.delete(cacheKey(chain, mint));
    return null;
  }
  return { ...entry.snapshot, cache_hit: true };
}

function setCache(chain: string, mint: string, snapshot: MarketSnapshot) {
  _cache.set(cacheKey(chain, mint), {
    snapshot,
    expires_at: Date.now() + CACHE_TTL_MS,
  });
}

const GECKO_BASE = "https://api.geckoterminal.com/api/v2";

async function fetchGeckoTerminal(mint: string, debug = false): Promise<MarketSnapshot | null> {
  try {
    const url = `${GECKO_BASE}/networks/solana/tokens/${mint}/pools?page=1`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      if (debug) console.warn(`[marketProviders] GeckoTerminal HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const pools = json?.data;
    if (debug) console.log(`[marketProviders] GeckoTerminal pools found: ${pools?.length ?? 0}`);
    if (!pools || pools.length === 0) return null;

    const pool = pools[0];
    const attrs = pool.attributes ?? {};
    const rel = pool.relationships ?? {};

    const price = parseFloat(attrs.base_token_price_usd) || null;
    const liquidity_usd = parseFloat(attrs.reserve_in_usd) || null;
    const volume_24h_usd = parseFloat(attrs.volume_usd?.h24) || null;
    const fdv_usd = parseFloat(attrs.fdv_usd) || null;
    const pool_address = attrs.address ?? null;
    const dex = rel?.dex?.data?.id ?? null;

    console.log(`[marketProviders] provider_used=geckoterminal pool=${pool_address} liquidity=${liquidity_usd}`);

    const pool_created = attrs.pool_created_at ? new Date(attrs.pool_created_at).getTime() : null;
    const pair_age_days = pool_created ? Math.floor((Date.now() - pool_created) / 86400000) : null;
    return {
      source: "geckoterminal",
      primary_pool: pool_address,
      dex,
      url: pool_address ? `https://www.geckoterminal.com/solana/pools/${pool_address}` : null,
      price,
      liquidity_usd,
      volume_24h_usd,
      fdv_usd,
      pair_age_days,
      fetched_at: new Date().toISOString(),
      cache_hit: false,
      data_unavailable: false,
    };
  } catch (err) {
    console.error(`[marketProviders] GeckoTerminal error:`, err);
    return null;
  }
}

async function fetchDexScreener(mint: string, debug = false): Promise<MarketSnapshot | null> {
  try {
    const url = `https://api.dexscreener.com/tokens/v1/solana/${mint}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (debug) console.log(`[marketProviders] DexScreener HTTP ${res.status}`);
    if (!res.ok) return null;

    const json = await res.json();
    const pairs: any[] = Array.isArray(json) ? json : json?.pairs ?? [];
    if (debug) console.log(`[marketProviders] DexScreener pairs found: ${pairs?.length ?? 0}`);
    if (!pairs || pairs.length === 0) return null;

    const sorted = pairs
      .filter((p) => p.chainId === "solana")
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

    const top = sorted[0];
    if (!top) return null;

    console.log(`[marketProviders] provider_used=dexscreener pool=${top.pairAddress}`);

    const pairCreatedAt = top.pairCreatedAt ? Number(top.pairCreatedAt) : null;
    const pair_age_days = pairCreatedAt ? Math.floor((Date.now() - pairCreatedAt) / 86400000) : null;
    return {
      source: "dexscreener",
      primary_pool: top.pairAddress ?? null,
      dex: top.dexId ?? null,
      url: top.url ?? null,
      price: parseFloat(top.priceUsd) || null,
      liquidity_usd: top.liquidity?.usd ?? null,
      volume_24h_usd: top.volume?.h24 ?? null,
      fdv_usd: top.fdv ?? null,
      pair_age_days,
      fetched_at: new Date().toISOString(),
      cache_hit: false,
      data_unavailable: false,
    };
  } catch (err) {
    console.error(`[marketProviders] DexScreener error:`, err);
    return null;
  }
}

function nullSnapshot(reason = "All providers failed"): MarketSnapshot {
  return {
    source: null,
    primary_pool: null,
    dex: null,
    url: null,
    price: null,
    liquidity_usd: null,
    volume_24h_usd: null,
    fdv_usd: null,
    pair_age_days: null,
    fetched_at: new Date().toISOString(),
    cache_hit: false,
    data_unavailable: true,
    reason,
  };
}

export async function getMarketSnapshot(
  chain: "solana",
  mint: string,
  debug = false
): Promise<MarketSnapshot> {
  const cached = getCached(chain, mint);
  if (cached) {
    console.log(`[marketProviders] cache_hit=true key=${chain}:${mint}`);
    return cached;
  }

  console.log(`[marketProviders] cache_hit=false fetching for ${chain}:${mint}`);

  let snapshot = await fetchDexScreener(mint, debug);
  if (!snapshot || (!snapshot.price && !snapshot.liquidity_usd)) {
    if (debug) console.log(`[marketProviders] DexScreener insufficient — trying GeckoTerminal`);
    const gecko = await fetchGeckoTerminal(mint, debug);
    // Pick best available (more non-null fields)
    if (gecko) {
      const dexScore = snapshot ? [snapshot.price, snapshot.liquidity_usd, snapshot.volume_24h_usd, snapshot.fdv_usd].filter(Boolean).length : 0;
      const geckoScore = [gecko.price, gecko.liquidity_usd, gecko.volume_24h_usd, gecko.fdv_usd].filter(Boolean).length;
      if (geckoScore >= dexScore) snapshot = gecko;
    }
  }
  if (!snapshot || snapshot.data_unavailable) {
    console.error(`[marketProviders] ALL providers failed — returning null snapshot`);
    snapshot = nullSnapshot("DexScreener and GeckoTerminal both unavailable");
  }

  setCache(chain, mint, snapshot);
  return snapshot;
}

// ─────────────────────────────────────────────────────────────────────────────
// TICKER RESOLUTION SUPPORT (additive — used by /api/scan/resolve)
//
// New surface area only. getMarketSnapshot(mint) above is UNCHANGED — the 11
// routes that import it keep the same signature. Everything below is exported
// helpers + searchDexScreenerPairs (a ticker→pairs search, distinct from the
// mint-keyed fetchDexScreener used by getMarketSnapshot).
// ─────────────────────────────────────────────────────────────────────────────

export type TickerMatchType =
  | "exact"
  | "query_starts_with_symbol"
  | "symbol_starts_with_query";

// Short, app-canonical chain codes (same enum the demo scan routing + the
// TokenPicker CHAIN_LABEL already use). "OTHER" = recognised pair on a chain we
// don't route — displayable but never auto-resolved.
export type ResolveChain =
  | "SOL"
  | "ETH"
  | "BSC"
  | "TRON"
  | "HYPER"
  | "BASE"
  | "ARBITRUM"
  | "OTHER";

export type ResolveSource = "curated" | "mentions" | "dexscreener" | "coingecko";

export interface ResolvedTokenCandidate {
  ticker: string;
  name: string | null;
  mint: string;
  chain: ResolveChain;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  pairCreatedAt: number | null;
  source: ResolveSource;
  matchType: TickerMatchType;
  lowLiquidity: boolean;
  // Internal sources (curated/mentions) carry the count of distinct KOLs on
  // file; external sources leave it at 0.
  kolCount?: number;
}

export type ResolveStatus = "resolved" | "ambiguous" | "not_found";

// Generic tickers: never prefix-auto-matched. Force exact (and exact-multiple
// then resolves to ambiguous). Editable on purpose.
export const GENERIC_TICKERS = new Set<string>([
  "AI", "DOG", "CAT", "PEPE", "BTC", "ETH", "SOL", "USDT", "USDC", "BNB",
  "XRP", "DOGE", "SHIB", "MEME", "MOON", "INU", "PUMP",
]);

const KNOWN_ROUTABLE_CHAINS: ResolveChain[] = ["SOL", "ETH", "BSC", "BASE", "ARBITRUM"];

// Strip $, whitespace, dashes, underscores; uppercase. Used for BOTH query and
// stored/on-pair symbol before comparison.
export function normalizeSymbol(s: string | null | undefined): string {
  if (!s) return "";
  return s.toUpperCase().replace(/[$\s_-]/g, "");
}

// Both arguments must already be normalised (normalizeSymbol). Returns null when
// there is no acceptable match. Prefix matches are gated:
//   min(len) >= 4  AND  maxLen/minLen <= 3   (TOES↔TOESCOIN ok; CAT↔CATGIRL no)
// Generic tickers only ever match exact.
export function tickerMatchType(qn: string, sn: string): TickerMatchType | null {
  if (!qn || !sn) return null;
  if (qn === sn) return "exact";
  if (GENERIC_TICKERS.has(qn) || GENERIC_TICKERS.has(sn)) return null;
  const minL = Math.min(qn.length, sn.length);
  const maxL = Math.max(qn.length, sn.length);
  if (minL < 4) return null;
  if (maxL / minL > 3) return null;
  // query is longer, stored symbol is a leading slice of it (TOESCOIN ⊃ TOES):
  // the stored symbol begins (starts off) the typed query → symbol_starts_with_query.
  if (qn.startsWith(sn)) return "symbol_starts_with_query";
  // stored symbol is longer, typed query is a leading slice of it (TOES → TOESCOIN):
  // the typed query begins (starts off) the stored symbol → query_starts_with_symbol.
  if (sn.startsWith(qn)) return "query_starts_with_symbol";
  return null;
}

// Strict candidate ordering:
//   1. exact before prefix
//   2. Solana preference at equal matchType (app is Solana-first)
//   3. liquidityUsd desc   4. volume24hUsd desc   5. pairCreatedAt desc
// An exact at 8k liq beats a prefix at 40k liq (rule 1 outranks rule 3).
export function compareResolveCandidates(
  a: ResolvedTokenCandidate,
  b: ResolvedTokenCandidate,
): number {
  const rank = (c: ResolvedTokenCandidate) => (c.matchType === "exact" ? 2 : 1);
  let d = rank(b) - rank(a);
  if (d) return d;
  const sol = (c: ResolvedTokenCandidate) => (c.chain === "SOL" ? 1 : 0);
  d = sol(b) - sol(a);
  if (d) return d;
  d = (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1);
  if (d) return d;
  d = (b.volume24hUsd ?? -1) - (a.volume24hUsd ?? -1);
  if (d) return d;
  d = (b.pairCreatedAt ?? -1) - (a.pairCreatedAt ?? -1);
  if (d) return d;
  return 0;
}

// Decides resolved / ambiguous / not_found from an ALREADY-SORTED list.
// Internal (curated/mentions) hits are trusted: a single one auto-resolves even
// on a prefix match. External hits must be exact + adequately liquid, and a
// low-liquidity hit (<1000) is never auto-resolved silently.
export function decideResolution(sorted: ResolvedTokenCandidate[]): ResolveStatus {
  if (sorted.length === 0) return "not_found";
  const top = sorted[0];
  const second = sorted[1];
  const exacts = sorted.filter((c) => c.matchType === "exact");
  const knownChain = KNOWN_ROUTABLE_CHAINS.includes(top.chain);
  const isInternal = top.source === "curated" || top.source === "mentions";

  if (exacts.length >= 2) {
    const chains = new Set(exacts.map((c) => c.chain));
    if (chains.size > 1) {
      // Cross-chain exact collision: only resolve if the leader clearly
      // dominates (≥2x liquidity). A chain mistake is critical on an anti-scam.
      const a = top.liquidityUsd ?? 0;
      const b = second?.liquidityUsd ?? 0;
      const ratio = b > 0 ? a / b : a > 0 ? Infinity : 0;
      if (!(ratio >= 2)) return "ambiguous";
      // dominant leader → fall through to eligibility checks
    } else {
      // Multiple exact matches on the same chain = genuinely distinct tokens.
      return "ambiguous";
    }
  } else if (sorted.length >= 2) {
    // Several candidates, at most one exact. A prefix top is never auto-picked.
    if (top.matchType !== "exact") return "ambiguous";
  }

  if (!knownChain) return "ambiguous";
  if (isInternal) return "resolved";
  if (top.matchType === "exact" && !top.lowLiquidity) return "resolved";
  return "ambiguous";
}

const DEX_CHAIN_MAP: Record<string, ResolveChain> = {
  solana: "SOL",
  ethereum: "ETH",
  base: "BASE",
  bsc: "BSC",
};

// Ticker → candidate pairs via DexScreener public search (keyless, no auth
// header). Network/parse failures return [] so the resolver falls through to
// CoinGecko without crashing. Inclusion threshold: liquidity.usd >= 250.
export async function searchDexScreenerPairs(
  query: string,
): Promise<ResolvedTokenCandidate[]> {
  const qn = normalizeSymbol(query);
  if (!qn) return [];
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return [];
    const json = await res.json();
    const pairs: any[] = Array.isArray(json?.pairs) ? json.pairs : [];

    const grouped = new Map<string, ResolvedTokenCandidate>();
    for (const p of pairs) {
      const symRaw = p?.baseToken?.symbol;
      const mint = p?.baseToken?.address;
      if (!symRaw || !mint) continue;
      const matchType = tickerMatchType(qn, normalizeSymbol(symRaw));
      if (!matchType) continue;
      const liq = typeof p?.liquidity?.usd === "number" ? p.liquidity.usd : null;
      if (liq === null || liq < 250) continue; // hard inclusion floor
      const chain = DEX_CHAIN_MAP[p?.chainId] ?? "OTHER";
      const candidate: ResolvedTokenCandidate = {
        ticker: String(symRaw).replace(/^\$+/, "").toUpperCase(),
        name: p?.baseToken?.name ?? null,
        mint: String(mint),
        chain,
        liquidityUsd: liq,
        volume24hUsd: typeof p?.volume?.h24 === "number" ? p.volume.h24 : null,
        pairCreatedAt: typeof p?.pairCreatedAt === "number" ? p.pairCreatedAt : null,
        source: "dexscreener",
        matchType,
        lowLiquidity: liq < 1000,
        kolCount: 0,
      };
      const key = chain + ":" + candidate.mint.toLowerCase();
      const existing = grouped.get(key);
      // Keep the most liquid pair per (chain, mint).
      if (!existing || (candidate.liquidityUsd ?? 0) > (existing.liquidityUsd ?? 0)) {
        grouped.set(key, candidate);
      }
    }

    return Array.from(grouped.values())
      .sort(compareResolveCandidates)
      .slice(0, 5);
  } catch {
    return [];
  }
}
