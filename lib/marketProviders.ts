export type MarketSnapshot = {
  source: "geckoterminal" | "dexscreener" | null;
  primary_pool: string | null;
  dex: string | null;
  url: string | null;
  price: number | null;
  liquidity_usd: number | null;
  volume_24h_usd: number | null;
  fdv_usd: number | null;
  fetched_at: string;
  cache_hit: boolean;
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

async function fetchGeckoTerminal(mint: string): Promise<MarketSnapshot | null> {
  try {
    const url = `${GECKO_BASE}/networks/solana/tokens/${mint}/pools?page=1`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[marketProviders] GeckoTerminal HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const pools = json?.data;
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

    return {
      source: "geckoterminal",
      primary_pool: pool_address,
      dex,
      url: pool_address ? `https://www.geckoterminal.com/solana/pools/${pool_address}` : null,
      price,
      liquidity_usd,
      volume_24h_usd,
      fdv_usd,
      fetched_at: new Date().toISOString(),
      cache_hit: false,
    };
  } catch (err) {
    console.error(`[marketProviders] GeckoTerminal error:`, err);
    return null;
  }
}

async function fetchDexScreener(mint: string): Promise<MarketSnapshot | null> {
  try {
    const url = `https://api.dexscreener.com/tokens/v1/solana/${mint}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const json = await res.json();
    const pairs: any[] = Array.isArray(json) ? json : json?.pairs ?? [];
    if (!pairs || pairs.length === 0) return null;

    const sorted = pairs
      .filter((p) => p.chainId === "solana")
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

    const top = sorted[0];
    if (!top) return null;

    console.log(`[marketProviders] provider_used=dexscreener pool=${top.pairAddress}`);

    return {
      source: "dexscreener",
      primary_pool: top.pairAddress ?? null,
      dex: top.dexId ?? null,
      url: top.url ?? null,
      price: parseFloat(top.priceUsd) || null,
      liquidity_usd: top.liquidity?.usd ?? null,
      volume_24h_usd: top.volume?.h24 ?? null,
      fdv_usd: top.fdv ?? null,
      fetched_at: new Date().toISOString(),
      cache_hit: false,
    };
  } catch (err) {
    console.error(`[marketProviders] DexScreener error:`, err);
    return null;
  }
}

function nullSnapshot(): MarketSnapshot {
  return {
    source: null,
    primary_pool: null,
    dex: null,
    url: null,
    price: null,
    liquidity_usd: null,
    volume_24h_usd: null,
    fdv_usd: null,
    fetched_at: new Date().toISOString(),
    cache_hit: false,
  };
}

export async function getMarketSnapshot(
  chain: "solana",
  mint: string
): Promise<MarketSnapshot> {
  const cached = getCached(chain, mint);
  if (cached) {
    console.log(`[marketProviders] cache_hit=true key=${chain}:${mint}`);
    return cached;
  }

  console.log(`[marketProviders] cache_hit=false fetching for ${chain}:${mint}`);

  let snapshot = await fetchGeckoTerminal(mint);
  if (!snapshot) {
    console.log(`[marketProviders] GeckoTerminal failed — trying DexScreener`);
    snapshot = await fetchDexScreener(mint);
  }
  if (!snapshot) {
    console.error(`[marketProviders] ALL providers failed — returning null snapshot`);
    snapshot = nullSnapshot();
  }

  setCache(chain, mint, snapshot);
  return snapshot;
}
