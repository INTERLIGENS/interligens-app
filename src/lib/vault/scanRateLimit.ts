// src/lib/vault/scanRateLimit.ts
//
// Limiteur des routes de scan on-chain.
//
// Ce module portait son propre store `Map` en mémoire ("For prod: swap store
// with Upstash Redis" — c'est fait ici). Sur Vercel chaque lambda avait le
// sien : le plafond n'était jamais réellement appliqué en production.
//
// Délègue désormais à src/lib/security/rateLimit.ts (sliding window Upstash
// partagé, fallback mémoire en dev/CI).
//
// ⚠️ Les deux fonctions sont désormais ASYNCHRONES — les appelants doivent
// les `await`.
//
// VARIABLES D'ENV — état vérifié sur le projet Vercel interligens-app :
//   SCAN_RATE_LIMIT    posée en Production, Preview ET Development (valeur
//                      locale "60", identique au défaut du code). CONSERVÉE
//                      comme override du plafond de checkScanJobLimit, pour
//                      ne pas changer silencieusement un plafond de prod dont
//                      la valeur n'est pas lisible sans `vercel env pull`
//                      (interdit ici : il supprime ADMIN_TOKEN).
//   EXPLAIN_RATE_LIMIT absente partout — retrait inerte.
//   RATE_WINDOW_MS     absente partout — retrait inerte.
import {
  checkRateLimit,
  RATE_LIMIT_PRESETS,
  type RateLimitResult,
} from "@/lib/security/rateLimit";

/** Plafond du job de scan graph : override d'env s'il est posé et valide. */
function scanJobMax(): number {
  const raw = Number.parseInt(process.env.SCAN_RATE_LIMIT ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : RATE_LIMIT_PRESETS.scanJob.max;
}

/**
 * Scans on-chain de lecture — 20 req / 1 min / IP (preset `scan`).
 *
 * Aligné sur /api/scan/bsc et /api/scan/eth, qui utilisaient déjà ce preset.
 * FAIL-OPEN : surfaces produit visibles, une panne Upstash ne doit pas les
 * couper.
 */
export function checkScanLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(ip, RATE_LIMIT_PRESETS.scan);
}

/**
 * Création d'un job de scan graph Solana — 60 req / 5 min / IP, FAIL-CLOSED.
 *
 * Bucket distinct et politique distincte : ce POST met en file une expansion
 * de graphe Helius (RPC payant) et écrit en DB, sans authentification. Voir
 * RATE_LIMIT_PRESETS.scanJob. Fenêtre et plafond repris à l'identique de
 * l'ancien checkScanLimit (60 / 5 min).
 */
export function checkScanJobLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(ip, { ...RATE_LIMIT_PRESETS.scanJob, max: scanJobMax() });
}

/**
 * Explications Intel Vault — 20 req / 1 min / IP, bucket séparé.
 *
 * Aucun appelant à ce jour ; conservé pour ne pas casser l'export public de
 * src/lib/vault/index.ts. Réutilise le preset `scan` avec un keyPrefix propre
 * pour que les deux compteurs restent indépendants.
 */
export function checkExplainLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(ip, { ...RATE_LIMIT_PRESETS.scan, keyPrefix: "rl:explain" });
}
