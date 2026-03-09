/**
 * src/lib/security/auth.ts
 *
 * Guard Bearer token pour les routes API sensibles.
 *
 * Config: variable d'environnement ADMIN_TOKEN (Vercel env / .env.local)
 * @pr4:migrated-to-ADMIN_TOKEN — INTERLIGENS_API_TOKEN retiré 2026-03-15
 *
 * Accepte le token via:
 *   - Header:  Authorization: Bearer <token>
 *   - Query:   ?token=<token>  (utile pour tests Postman / webhooks)
 *
 * Sécurité:
 *   - Comparaison en temps constant (timingSafeEqual) pour éviter les timing attacks
 *   - Aucun détail sur la raison du rejet dans la réponse (pas de leak "token absent" vs "token invalide")
 *   - Token jamais loggué
 */

import { detectLocale } from "./rateLimit";

// ── Extraction du token depuis la requête ────────────────────────────────────

export function extractBearerToken(req: Request): string | null {
  // 1. Header Authorization: Bearer <token>
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token.length > 0) return token;
  }

  // 2. Custom header x-admin-token (UI)
  const xToken = req.headers.get("x-admin-token")?.trim();
  if (xToken && xToken.length > 0) return xToken;

  // 3. Query param ?token= (fallback)
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token")?.trim();
  if (queryToken && queryToken.length > 0) return queryToken;

  return null;
}

// ── Comparaison en temps constant ────────────────────────────────────────────

/**
 * Compare deux strings en temps constant pour éviter les timing attacks.
 * Utilise crypto.subtle disponible dans le runtime Edge/Node 20.
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  // Longueurs différentes = toujours faux, mais on ne court-circuite pas pour rester constant
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);

  // Pad à la même longueur pour que l'XOR soit comparable
  const len = Math.max(aBytes.length, bBytes.length);
  const aPad = new Uint8Array(len);
  const bPad = new Uint8Array(len);
  aPad.set(aBytes);
  bPad.set(bBytes);

  // XOR byte à byte — si identiques, sum = 0
  let diff = 0;
  for (let i = 0; i < len; i++) {
    diff |= aPad[i] ^ bPad[i];
  }

  // Différence de longueur
  diff |= aBytes.length ^ bBytes.length;

  return diff === 0;
}

// ── Réponse 401 i18n ─────────────────────────────────────────────────────────

const UNAUTHORIZED_MESSAGES = {
  en: "Unauthorized. A valid API token is required.",
  fr: "Non autorisé. Un token API valide est requis.",
};

export function unauthorizedResponse(req: Request): Response {
  const locale = detectLocale(req);
  return new Response(
    JSON.stringify({ error: UNAUTHORIZED_MESSAGES[locale] }),
    {
      status: 401,
      headers: {
        "Content-Type":             "application/json",
        "WWW-Authenticate":         'Bearer realm="INTERLIGENS API"',
        "X-Content-Type-Options":   "nosniff",
      },
    }
  );
}

// ── Guard principal ───────────────────────────────────────────────────────────

export interface AuthResult {
  authorized: boolean;
  response?: Response; // présent si authorized === false
}

/**
 * Vérifie le token Bearer de la requête contre ADMIN_TOKEN.
 *
 * Usage dans une route:
 *   const auth = await checkAuth(req);
 *   if (!auth.authorized) return auth.response!;
 */
export async function checkAuth(req: Request): Promise<AuthResult> {
  const expected = process.env.ADMIN_TOKEN ?? "";

  // Si la var d'env n'est pas configurée, on bloque tout (pas de fail-open sur auth)
  if (expected.length === 0) {
    console.error("[auth] ADMIN_TOKEN is not set — blocking request");
    return { authorized: false, response: unauthorizedResponse(req) };
  }

  const provided = extractBearerToken(req);

  if (!provided) {
    return { authorized: false, response: unauthorizedResponse(req) };
  }

  const valid = await timingSafeEqual(provided, expected);

  if (!valid) {
    return { authorized: false, response: unauthorizedResponse(req) };
  }

  return { authorized: true };
}
