// ─── Instrumentation des providers — un seul chemin, compté et borné ───────
// Tout appel sortant de la V3 passe ici. Trois garanties, dans cet ordre :
//
//   1. CACHE      un résultat déjà obtenu n'est pas repayé. Le succès de cache
//                 est compté par provider, pas globalement : « on a économisé
//                 12 appels » n'aide pas si on ignore lesquels.
//   2. BUDGET     plafond dur d'appels par exécution et par provider. Au-delà,
//                 l'appel est REFUSÉ et compté (budgetRefusals). Jamais omis en
//                 silence : une couverture tronquée qui ne se voit pas est lue
//                 comme une couverture complète.
//   3. COMPTAGE   ce qui part réellement sur le réseau.
//
// Le cache est borné par exécution (mémoire du process, plafond d'entrées) :
// pas de table, pas de migration. Sur Vercel, cron et requête web ne partagent
// pas d'instance — ce cache borne le coût d'UNE exécution, pas celui du jour.

import { DEFAULT_POLICY } from "../policy";
import type { ProviderContext } from "./types";
import type { ProviderCallCounts } from "../types";

export type ProviderName = keyof ProviderCallCounts;

/**
 * Enveloppe un appel provider. `fallback` est la valeur rendue quand le budget
 * est épuisé — elle doit toujours signifier « je n'ai pas la réponse », jamais
 * « la réponse est vide », pour que l'appelant puisse noter la limitation.
 */
export async function instrumentedCall<T>(
  ctx: ProviderContext,
  provider: ProviderName,
  cacheKey: string,
  ttlMs: number | undefined,
  fallback: T,
  produce: () => Promise<T>,
): Promise<T> {
  const cached = ctx.cache.peek<T>(cacheKey);
  if (cached.hit) {
    ctx.telemetry.providerCacheHits[provider]++;
    return cached.value;
  }

  // Sans budget explicite dans le contexte (appel direct d'adaptateur), on
  // retombe sur la valeur par défaut de la politique. resolveToken, lui, pose
  // toujours le budget issu de la politique qu'on lui a passée.
  const ceiling = ctx.budget?.maxCallsPerProvider ?? DEFAULT_POLICY.maxProviderCallsPerRun;
  if (ctx.telemetry.providerCalls[provider] >= ceiling) {
    ctx.telemetry.budgetRefusals++;
    return fallback;
  }

  return ctx.cache.wrap(cacheKey, ttlMs, async () => {
    ctx.telemetry.providerCalls[provider]++;
    return produce();
  });
}

/** Recopie les compteurs du cache dans la télémétrie, en fin d'exécution. */
export function syncCacheTelemetry(ctx: ProviderContext): void {
  const s = ctx.cache.stats();
  ctx.telemetry.cacheHits = s.hits;
  ctx.telemetry.cacheMisses = s.misses;
  ctx.telemetry.cacheEntries = s.entries;
}
