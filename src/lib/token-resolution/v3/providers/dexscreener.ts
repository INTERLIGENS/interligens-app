// ─── Adapter DexScreener ───────────────────────────────────────────────────
// Deux opérations, toutes deux passées au cache obligatoire :
//   byAddress(chain, address)  GET /tokens/v1/{chain}/{address}
//   searchTicker(ticker)       GET /latest/dex/search?q=
// Sans clé d'API. Formes de réponse vérifiées sur appels réels le 2026-08-26 et
// figées en fixtures (__fixtures__/dexscreener.*.json).
//
// Filtres appliqués ici, et nulle part ailleurs :
//   • la paire doit porter NOTRE adresse en baseToken — DexScreener renvoie
//     aussi des paires où le token cherché est le quote ;
//   • chainId inconnu de notre table (l'appel réel a renvoyé "robinhood") →
//     ignoré, jamais deviné ;
//   • une paire par adresse : la plus liquide. Les autres sont du bruit de
//     marché, pas des identités distinctes.

import { normalizeChain, type CanonicalChain } from "../chain";
import { normalizeAddress } from "../address";
import { cleanTicker } from "../symbol";
import { instrumentedCall } from "./instrument";
import type { ProviderContext, ProviderMarket } from "./types";

const BASE = "https://api.dexscreener.com";
const TTL_MS = 5 * 60 * 1000;

/** Code de chaîne attendu par l'URL DexScreener. */
const CHAIN_SLUG: Partial<Record<CanonicalChain, string>> = {
  SOL: "solana",
  ETH: "ethereum",
  BSC: "bsc",
  BASE: "base",
  ARBITRUM: "arbitrum",
};

interface DexPair {
  chainId?: string;
  baseToken?: { address?: string; symbol?: string; name?: string };
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  pairCreatedAt?: number;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function toMarket(p: DexPair): ProviderMarket | null {
  const address = p.baseToken?.address;
  const chainRaw = p.chainId;
  if (!address || !chainRaw) return null;
  return {
    chainRaw,
    address,
    symbol: cleanTicker(p.baseToken?.symbol) || null,
    name: p.baseToken?.name ?? null,
    liquidityUsd: num(p.liquidity?.usd),
    volume24hUsd: num(p.volume?.h24),
    pairCreatedAt: num(p.pairCreatedAt),
  };
}

/** Garde la paire la plus liquide par identité (chaîne canonique + adresse). */
function keepMostLiquidPerIdentity(markets: ProviderMarket[]): ProviderMarket[] {
  const best = new Map<string, ProviderMarket>();
  for (const m of markets) {
    const chain = normalizeChain(m.chainRaw);
    if (!chain) continue; // chaîne hors table — jamais devinée
    const norm = normalizeAddress(m.address, chain);
    if (!norm.valid || !norm.address) continue;
    const key = `${chain}:${norm.address}`;
    const cur = best.get(key);
    if (!cur || (m.liquidityUsd ?? -1) > (cur.liquidityUsd ?? -1)) {
      best.set(key, { ...m, chainRaw: chain, address: norm.address });
    }
  }
  return Array.from(best.values());
}

/**
 * Marché d'une adresse précise. null quand DexScreener n'indexe pas encore le
 * token — cas courant d'un pump.fun de quelques minutes, qui existe on-chain
 * bien avant d'être indexé. C'est ce trou que couvre l'adapter Helius.
 */
export async function dexScreenerByAddress(
  ctx: ProviderContext,
  chain: CanonicalChain,
  address: string,
): Promise<ProviderMarket | null> {
  const slug = CHAIN_SLUG[chain];
  if (!slug) return null;
  const key = `dexscreener:byAddress:${chain}:${address}`;
  return instrumentedCall<ProviderMarket | null>(ctx, "dexScreener", key, TTL_MS, null, async () => {
    const res = await ctx.http.getJson(`${BASE}/tokens/v1/${slug}/${address}`);
    if (!res.ok) return null;
    const raw = res.json;
    const pairs: DexPair[] = Array.isArray(raw)
      ? (raw as DexPair[])
      : (((raw as { pairs?: DexPair[] } | null)?.pairs ?? []) as DexPair[]);
    const mine = pairs
      .map(toMarket)
      .filter((m): m is ProviderMarket => !!m)
      .filter((m) => m.address.toLowerCase() === address.toLowerCase());
    const [top] = keepMostLiquidPerIdentity(mine).sort(
      (a, b) => (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1),
    );
    return top ?? null;
  });
}

/** Recherche par ticker. Liste dédupliquée par identité, la plus liquide gagne. */
export async function dexScreenerSearchTicker(
  ctx: ProviderContext,
  ticker: string,
): Promise<ProviderMarket[]> {
  const q = cleanTicker(ticker);
  if (!q) return [];
  const key = `dexscreener:search:${q}`;
  return instrumentedCall<ProviderMarket[]>(ctx, "dexScreener", key, TTL_MS, [], async () => {
    const res = await ctx.http.getJson(`${BASE}/latest/dex/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const pairs = ((res.json as { pairs?: DexPair[] } | null)?.pairs ?? []) as DexPair[];
    const markets = pairs.map(toMarket).filter((m): m is ProviderMarket => !!m);
    return keepMostLiquidPerIdentity(markets);
  });
}
