/**
 * src/lib/security/nominativeApiGate.ts
 *
 * P0-1 — GOUVERNANCE DE PUBLICATION : le gate des lectures NOMINATIVES.
 *
 * Le problème corrigé ici est une ASYMÉTRIE, pas un trou isolé :
 * `src/proxy.ts` met toutes les pages produit derrière le cookie beta
 * (`isBetaExempt` → fail-closed) mais exempte explicitement `/api/*`
 * ("API routes have their own per-route guards"). Or une partie des routes
 * nominatives n'avait AUCUN garde : `/api/watchlist`, `/api/cluster/[handle]`,
 * `/api/coordination/[handle]`, `/api/kol*`, `/api/explorer`, `/api/v1/kol*`
 * répondaient 200 en anonyme avec handle, displayName, tier, rôle et
 * association à un case / un token. La page était fermée, sa source de
 * données ouverte.
 *
 * Ce module ne décide QUE de deux choses, et il les décide de façon
 * synchrone parce que le proxy Next tourne en runtime edge (pas de Prisma,
 * pas d'appel réseau possible) :
 *
 *   1. `isNominativeApiPath(pathname)` — ce chemin sert-il du nominatif ?
 *   2. `hasNominativeCredential(req)` — l'appelant est-il un appelant légitime ?
 *
 * APPELANTS LÉGITIMES PRÉSERVÉS (inventaire, voir le rapport P0-1) :
 *   - front interne  : les pages /en/* et /fr/* appellent ces routes en
 *                      same-origin ; le navigateur joint le cookie
 *                      `investigator_session` posé par /api/beta/auth/login.
 *   - admin          : cookie `admin_session` (UI) ou `x-admin-token` /
 *                      cookie `admin_token` (scripts curl).
 *   - intégrations   : en-tête `x-partner-key` (PARTNER_API_KEY_V2 /
 *                      PARTNER_API_KEY), déjà le mécanisme de /api/partner/v1/*.
 *   - app iOS        : en-tête `x-mobile-api-token` (MOBILE_API_TOKEN), déjà
 *                      le mécanisme de /api/mobile/v1/*.
 *
 * LIMITE ASSUMÉE ET DOCUMENTÉE : le cookie beta est vérifié en PRÉSENCE, pas
 * en validité DB. C'est exactement le niveau de confiance des pages produit
 * (`src/proxy.ts` fait la même chose) — l'objectif de ce chantier est de
 * supprimer l'asymétrie, pas de créer une seconde asymétrie inverse. La
 * validation DB (révocation, expiration) vit dans
 * `getInvestigatorSessionContext` et exige un runtime Node : la porter ici
 * suppose de basculer le proxy en runtime nodejs. C'est un chantier séparé,
 * explicitement hors périmètre P0-1.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/security/adminAuth";

/** Cookie de session beta — identique à celui du gate pages dans proxy.ts. */
const BETA_COOKIE = "investigator_session";
/** Cookie admin porteur du token brut (posé par /api/admin/auth/login). */
const ADMIN_TOKEN_COOKIE = "admin_token";

// ── Chemins nominatifs ──────────────────────────────────────────────────────
//
// « Nominatif » = la réponse porte un handle, un displayName, un tier, un rôle,
// ou l'association d'une personne à un case / un token. Un agrégat anonyme
// (ex. `kolCount` sur /api/scan/resolve) n'entre PAS dans cette définition et
// n'est volontairement pas gaté : le scan public en dépend.

/** Chemins nominatifs en correspondance EXACTE (pas de sous-chemin). */
const NOMINATIVE_EXACT: readonly string[] = [
  "/api/kol",              // liste publique des profils KOL
  "/api/watchlist",        // 107 entrées watcher, dont 52 profils NON publiés
  "/api/explorer",         // Launch Dossiers + linkedActors nominatifs
  "/api/v1/kol",           // API partenaire — displayName + label
  "/api/v1/shill-to-exit", // timeline shill→exit par handle
  "/api/casefile/public",  // PDF de casefile nominatif
  // Route SANS aucun appelant dans le repo, mais VIVANTE en production et
  // ouverte : GET /api/scan/grounding?token=BOTIFY renvoyait
  // "5 actors linked to BOTIFY (@bkokoski, @sxyz500, @GordonGekko)", et
  // ?address=<wallet> renvoyait {"handle":"bkokoski", proceedsSummary, ...}.
  // Ni auth, ni rate-limit. Chemin EXACT : le reste de /api/scan/* (resolve,
  // solana, eth, timeline...) ne sert pas de nominatif et doit rester ouvert.
  "/api/scan/grounding",
  // P0 containment — POST /api/scan/ask etait la SEULE surface de proceeds
  // joignable en ANONYME : sonde du 2026-08-16, corps vide -> 400
  // `missing_fields`, pas 401. Il construit son contexte via
  // buildGroundingContext, qui y injecte handle, tier, cluster, signaux de
  // coordination et le montant (« Min. $580K observed — partial coverage »),
  // puis rend une reponse en PROSE generee par le modele.
  //
  // C'est la surface la plus difficile a rattraper apres coup : le montant ne
  // sort pas dans un champ JSON filtrable, il est reformule librement dans du
  // texte. Le filtre de proceedsGate l'empeche desormais d'entrer dans le
  // prompt ; ce gate ferme la lecture nominative elle-meme.
  "/api/scan/ask",
];

/** Préfixes nominatifs (le chemin doit commencer par, slash final inclus). */
const NOMINATIVE_PREFIXES: readonly string[] = [
  "/api/kol/",          // leaderboard, [handle], proceeds, cashout, class-action…
  "/api/cluster/",      // acteurs liés : handle + displayName + tier + rôles
  "/api/coordination/", // signaux de coordination par handle
  "/api/laundry/",      // trails de blanchiment par handle
  "/api/watchlist/",    // signals bruts non revus (handle + postUrl)
  "/api/explorer/",
  "/api/v1/kol/",
];

/** Chemins nominatifs à segment variable. */
const NOMINATIVE_PATTERNS: readonly RegExp[] = [
  // /api/token/{chain}/{address}/kol-alert → tableau `kols` nominatif
  /^\/api\/token\/[^/]+\/[^/]+\/kol-alert$/,
];

export function isNominativeApiPath(pathname: string): boolean {
  if (NOMINATIVE_EXACT.includes(pathname)) return true;
  for (const prefix of NOMINATIVE_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  for (const pattern of NOMINATIVE_PATTERNS) {
    if (pattern.test(pathname)) return true;
  }
  return false;
}

// ── Credentials ─────────────────────────────────────────────────────────────

/**
 * Lit un secret d'environnement en traitant la chaîne VIDE comme ABSENTE.
 *
 * `process.env.X ?? null` renvoie "" quand la variable est définie vide, et ""
 * comparé à "" en temps constant vaut `true` : une variable vidée par erreur
 * ouvrirait la porte à un appelant envoyant un en-tête vide. On refuse donc
 * explicitement la chaîne vide — c'est la cinquième famille de ce bug dans ce
 * repo, elle ne passera pas par ici.
 */
function envSecret(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw !== "string") return null;
  if (raw.length === 0) return null;
  return raw;
}

/**
 * Comparaison à temps constant, sans dépendance Node (`timingSafeEqual` n'est
 * pas disponible en runtime edge). Compare sur la longueur maximale et
 * intègre l'écart de longueur au diff, comme le fait déjà partnerAuth.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  const ap = new Uint8Array(len);
  const bp = new Uint8Array(len);
  ap.set(ab);
  bp.set(bb);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= ap[i] ^ bp[i];
  return diff === 0;
}

/** Valeur d'en-tête non vide, sinon null. */
function header(req: NextRequest, name: string): string | null {
  const raw = req.headers.get(name);
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

/** Identité de l'appelant reconnu — sert au log et aux tests. */
export type NominativeCaller =
  | "admin_session"
  | "admin_token"
  | "beta_session"
  | "partner_key"
  | "mobile_token";

/**
 * Retourne l'identité de l'appelant reconnu, ou null si aucune credential
 * valide n'est présente. Fail-closed : aucune branche NODE_ENV, aucun bypass
 * dev — le code de production ne connaît pas la notion d'« environnement de
 * test » (même doctrine que `requireSalt`).
 */
export function resolveNominativeCaller(req: NextRequest): NominativeCaller | null {
  // 1. Admin — cookie de session HMAC.
  if (verifyAdminSession(req)) return "admin_session";

  // 2. Admin — token brut (en-tête ou cookie), pour les scripts curl.
  const adminToken = envSecret("ADMIN_TOKEN");
  if (adminToken !== null) {
    const headerToken = header(req, "x-admin-token");
    const cookieToken = req.cookies.get(ADMIN_TOKEN_COOKIE)?.value ?? null;
    const provided = headerToken !== null ? headerToken : cookieToken;
    if (typeof provided === "string" && provided.length > 0) {
      if (constantTimeEquals(provided, adminToken)) return "admin_token";
    }
  }

  // 3. Front interne — cookie beta, même niveau de confiance que les pages.
  const betaCookie = req.cookies.get(BETA_COOKIE)?.value;
  if (typeof betaCookie === "string" && betaCookie.length > 0) return "beta_session";

  // 4. Intégrations partenaires — x-partner-key.
  const partnerKey = envSecret("PARTNER_API_KEY_V2") ?? envSecret("PARTNER_API_KEY");
  if (partnerKey !== null) {
    const provided = header(req, "x-partner-key");
    if (provided !== null && constantTimeEquals(provided, partnerKey)) return "partner_key";
  }

  // 5. App iOS — x-mobile-api-token.
  const mobileToken = envSecret("MOBILE_API_TOKEN");
  if (mobileToken !== null) {
    const provided = header(req, "x-mobile-api-token");
    if (provided !== null && constantTimeEquals(provided, mobileToken)) return "mobile_token";
  }

  return null;
}

/**
 * Réponse de refus. `no-store` + `Vary: Cookie` sont OBLIGATOIRES ici : sans
 * eux, un cache partagé en amont (Cloudflare) peut mémoriser le 401 anonyme
 * et le resservir à un appelant authentifié — c'est exactement la régression
 * SEC-2026-04 documentée dans proxy.ts, mais dans l'autre sens.
 */
export function nominativeAccessDenied(): NextResponse {
  const res = NextResponse.json(
    {
      error: "unauthorized",
      code: "NOMINATIVE_ACCESS_REQUIRED",
      detail:
        "This endpoint returns nominative data (handle, display name, tier, role, case or token association) and requires an authenticated caller.",
    },
    { status: 401 },
  );
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.headers.set("Vary", "Cookie, X-Partner-Key, X-Mobile-Api-Token, X-Admin-Token");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

/**
 * En-têtes anti-cache posés sur les réponses AUTORISÉES. Une réponse nominative
 * servie à un appelant authentifié ne doit jamais être mise en cache partagé
 * puis resservie à un anonyme.
 */
export function applyNominativeCacheHeaders(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.headers.set("Vary", "Cookie, X-Partner-Key, X-Mobile-Api-Token, X-Admin-Token");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
