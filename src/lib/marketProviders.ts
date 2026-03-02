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
