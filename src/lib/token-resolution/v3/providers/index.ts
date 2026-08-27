// ─── Assemblage des providers ──────────────────────────────────────────────
// Point d'entrée unique. Construire un contexte SANS cache est impossible :
// createProviderContext en fabrique un quand l'appelant n'en fournit pas, et la
// signature de ProviderContext exige le champ. C'est la garantie « cache
// obligatoire » exprimée dans les types, pas dans une convention.

import { ResolutionCache, type ResolutionCacheOptions } from "./cache";
import { realHttpClient } from "./http";
import type { HttpClient, ProviderBudget, ProviderContext, ProviderEnv } from "./types";
import { emptyTelemetry, type ResolutionTelemetry } from "../types";
import { DEFAULT_POLICY } from "../policy";

export { ResolutionCache } from "./cache";
export { realHttpClient } from "./http";
export * from "./types";
export { instrumentedCall, syncCacheTelemetry, type ProviderName } from "./instrument";
export { dexScreenerByAddress, dexScreenerSearchTicker } from "./dexscreener";
export { heliusMintExists, type MintExistence } from "./helius";
export { coinGeckoByTicker, type CoinGeckoResult } from "./coingecko";
export { hyperliquidResolveTokenId, type HyperToken } from "./hyperliquid";

export interface CreateProviderContextOptions {
  http?: HttpClient;
  cache?: ResolutionCache;
  cacheOptions?: ResolutionCacheOptions;
  telemetry?: ResolutionTelemetry;
  env?: ProviderEnv;
  budget?: ProviderBudget;
}

/**
 * La clé Helius est lue À L'APPEL, jamais au chargement du module : l'ordre
 * d'import ne doit pas décider si le fallback on-chain existe. Le résolveur V1
 * tenait déjà cette précaution, on la conserve.
 */
export function createProviderContext(
  opts: CreateProviderContextOptions = {},
): ProviderContext {
  return {
    http: opts.http ?? realHttpClient,
    cache: opts.cache ?? new ResolutionCache(opts.cacheOptions),
    telemetry: opts.telemetry ?? emptyTelemetry(),
    env: opts.env ?? { heliusApiKey: process.env.HELIUS_API_KEY ?? null },
    // Plafond par défaut aligné sur DEFAULT_POLICY.maxProviderCallsPerRun.
    budget: opts.budget ?? { maxCallsPerProvider: DEFAULT_POLICY.maxProviderCallsPerRun },
  };
}
