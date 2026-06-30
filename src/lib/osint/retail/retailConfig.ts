/**
 * src/lib/osint/retail/retailConfig.ts
 *
 * SPRINT C1 — KILL SWITCH & ENV de la porte retail OSINT.
 *
 * RÈGLE ABSOLUE : la porte reste FERMÉE par défaut. Tous les flags sont
 * fail-closed — une variable absente ou mal formée vaut "désactivé". Pour ouvrir,
 * il faut explicitement OSINT_RETAIL_SUBMIT_ENABLED=true (et, pour traiter,
 * OSINT_RETAIL_PROCESSING_ENABLED=true). On construit, on n'ouvre pas.
 *
 * Aucune logique métier ici : juste la lecture sûre de l'environnement. Lu via
 * process.env directement (pattern OSINT existant — callVision/verifyMint), pas
 * via le helper config/env (gelé).
 */

/** Un flag booléen n'est "on" que s'il vaut exactement la chaîne "true". */
function flagOn(raw: string | undefined): boolean {
  return raw === "true";
}

/**
 * Porte d'entrée publique. false par défaut → /submit et POST /api/osint/submit
 * renvoient "submissions closed" / 403. Doit être true pour accepter un envoi.
 */
export function isRetailSubmitEnabled(): boolean {
  return flagOn(process.env.OSINT_RETAIL_SUBMIT_ENABLED);
}

/**
 * Traitement vision. false par défaut → une soumission acceptée reste QUEUED
 * sans jamais appeler la vision (le processeur async refuse de tourner). Permet
 * d'ouvrir l'ingestion (collecte) sans encore dépenser de vision.
 */
export function isRetailProcessingEnabled(): boolean {
  return flagOn(process.env.OSINT_RETAIL_PROCESSING_ENABLED);
}

/** Budget vision journalier (USD). Défaut bas et bloquant : 5 $. */
export const DEFAULT_DAILY_VISION_BUDGET_USD = 5;

export function dailyVisionBudgetUsd(): number {
  const raw = process.env.OSINT_DAILY_VISION_BUDGET_USD;
  if (raw === undefined || raw === "") return DEFAULT_DAILY_VISION_BUDGET_USD;
  const n = Number(raw);
  // Valeur illisible ou négative → on retombe sur le défaut bas (fail-closed côté coût).
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DAILY_VISION_BUDGET_USD;
}

// ── Quotas & limites (constantes du sprint, non configurables par env) ─────────

/** Max de soumissions acceptées par IP-hash et par fenêtre de 24 h. */
export const MAX_SUBMITS_PER_IP_PER_DAY = 5;
/** Max d'images par envoi (batch). */
export const MAX_IMAGES_PER_SUBMIT = 3;
/** Taille max brute par image (octets). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
/** Cible de compression de la version vision (octets). */
export const VISION_TARGET_BYTES = Math.floor(4.5 * 1024 * 1024); // 4.5 MB
/** Côté long max de la version vision (px). */
export const VISION_MAX_LONG_EDGE = 2048;
/** Dimensions minimales exploitables (px) sous lesquelles → TOO_SMALL. */
export const MIN_IMAGE_EDGE = 200;
/** Longueur max conservée pour le contexte libre du soumetteur. */
export const MAX_CONTEXT_CHARS = 1000;
/** Longueur max conservée pour l'URL tweet. */
export const MAX_TWEET_URL_CHARS = 500;

/**
 * Coût estimé d'UNE image en vision : 2 passes (LOCK 1 double-lecture) à
 * VISION_COST_PER_PASS_USD. Réutilise l'estime d'observabilité (Sprint B) comme
 * source unique, pour que budget et dashboard parlent le même langage.
 */
export const VISION_PASSES_PER_IMAGE = 2;
