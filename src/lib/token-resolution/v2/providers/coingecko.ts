// ─── Adapter CoinGecko ─────────────────────────────────────────────────────
// DERNIER recours, et seulement pour les tokens listés : CoinGecko ne connaît
// pas les lancements récents, c'est-à-dire précisément la population que
// l'anti-arnaque doit attraper. Son intérêt est l'inverse : rattacher un ticker
// connu à ses adresses de contrat multi-chaînes, là où DexScreener ne renverrait
// que la paire la plus liquide.
//
// Deux étages d'appels (search puis coins/{id}), donc un coût réel : le nombre
// de coins détaillés est plafonné, et les deux étages passent par le cache.

import { normalizeChain } from "../chain";
import { normalizeAddress } from "../address";
import { cleanTicker, normalizeSymbol } from "../symbol";
import type { ProviderContext, ProviderMarket } from "./types";

const BASE = "https://api.coingecko.com/api/v3";
const TTL_SEARCH_MS = 10 * 60 * 1000;
const TTL_DETAIL_MS = 60 * 60 * 1000;
/** Plafond assumé : au-delà, le coût dépasse l'apport. Journalisé, jamais silencieux. */
const MAX_DETAILED_COINS = 3;

interface SearchCoin {
  id?: string;
  symbol?: string;
  name?: string;
}

interface CoinDetail {
  id?: string;
  symbol?: string;
  name?: string;
  platforms?: Record<string, string | null>;
}

export interface CoinGeckoResult {
  markets: ProviderMarket[];
  /** Nombre de coins écartés par le plafond. Remonté en limitation. */
  truncated: number;
}

export async function coinGeckoByTicker(
  ctx: ProviderContext,
  ticker: string,
): Promise<CoinGeckoResult> {
  const q = cleanTicker(ticker);
  if (!q) return { markets: [], truncated: 0 };

  const coins = await ctx.cache.wrap<SearchCoin[]>(
    `coingecko:search:${q}`,
    TTL_SEARCH_MS,
    async () => {
      ctx.telemetry.coinGeckoCalls++;
      const res = await ctx.http.getJson(`${BASE}/search?query=${encodeURIComponent(q)}`);
      if (!res.ok) return [];
      return ((res.json as { coins?: SearchCoin[] } | null)?.coins ?? []) as SearchCoin[];
    },
  );

  // Symbole EXACT seulement. CoinGecko renvoie des correspondances de nom très
  // larges ; les accepter fabriquerait des candidats sans rapport.
  const exact = coins.filter((c) => normalizeSymbol(c.symbol) === normalizeSymbol(q));
  const kept = exact.slice(0, MAX_DETAILED_COINS);
  const truncated = Math.max(0, exact.length - kept.length);

  const markets: ProviderMarket[] = [];
  for (const c of kept) {
    if (!c.id) continue;
    const detail = await ctx.cache.wrap<CoinDetail | null>(
      `coingecko:coin:${c.id}`,
      TTL_DETAIL_MS,
      async () => {
        ctx.telemetry.coinGeckoCalls++;
        const res = await ctx.http.getJson(
          `${BASE}/coins/${encodeURIComponent(c.id as string)}` +
            `?localization=false&tickers=false&market_data=false` +
            `&community_data=false&developer_data=false&sparkline=false`,
        );
        if (!res.ok) return null;
        return res.json as CoinDetail;
      },
    );
    if (!detail?.platforms) continue;
    for (const [platform, addr] of Object.entries(detail.platforms)) {
      if (!addr) continue;
      const chain = normalizeChain(platform);
      if (!chain) continue;
      const norm = normalizeAddress(addr, chain);
      if (!norm.valid || !norm.address) continue;
      markets.push({
        chainRaw: chain,
        address: norm.address,
        symbol: cleanTicker(detail.symbol) || null,
        name: detail.name ?? null,
        liquidityUsd: null,
        volume24hUsd: null,
        pairCreatedAt: null,
      });
    }
  }
  return { markets, truncated };
}
