/**
 * Limiteur de l'API publique de score — /api/v1/score et /api/v1/scan-context.
 *
 * Ce module portait son propre store `Map` en mémoire. Sur Vercel, chaque
 * lambda a le sien : le plafond n'était donc jamais réellement appliqué —
 * il suffisait que les requêtes tombent sur des instances différentes. Le
 * limiteur était décoratif en production.
 *
 * Il délègue désormais à src/lib/security/rateLimit.ts (sliding window Upstash
 * partagé entre lambdas, retombant sur le store mémoire quand
 * UPSTASH_REDIS_REST_URL/_TOKEN sont absents — dev et CI).
 *
 * Plafond INCHANGÉ : 60 req / 60 s / IP (preset `publicScore`). Le preset
 * `public` existant vaut 120/min ; le réutiliser aurait doublé l'allocation
 * d'une surface publique non authentifiée.
 *
 * FAIL-OPEN sur panne Upstash : ces deux routes ne déclenchent pas de coût
 * externe significatif, une panne du limiteur ne doit pas rendre la beta muette.
 *
 * ⚠️ La fonction est désormais ASYNCHRONE — les appelants doivent l'`await`.
 */
import {
  checkRateLimit as sharedCheckRateLimit,
  RATE_LIMIT_PRESETS,
  __resetStoreForTest,
} from "@/lib/security/rateLimit";

export async function checkRateLimit(ip: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
}> {
  const r = await sharedCheckRateLimit(ip, RATE_LIMIT_PRESETS.publicScore);
  return { allowed: r.allowed, remaining: r.remaining, resetAt: r.resetAt };
}

/** Reset store — tests only */
export function __resetForTest(): void {
  __resetStoreForTest();
}
