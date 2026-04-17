/**
 * src/lib/security/adminAuth.ts
 *
 * P1 — UNIFIED ADMIN AUTH
 * Single source of truth for all /api/admin/* route protection.
 *
 * - Token: ADMIN_TOKEN env var
 * - Header: x-admin-token
 * - Constant-time comparison (timingSafeEqual)
 * - Never throws 500 due to missing env; returns clear 401/403 JSON
 * - Compat: also accepts x-interligens-api-token for 7-day grace period (logs warning)
 */

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

// @pr1:cookie-support
const ADMIN_COOKIE_NAME = "admin_token";
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 8; // 8h

/** Session cookie — HMAC-signed proof-of-knowledge of ADMIN_BASIC_PASS. */
const ADMIN_SESSION_COOKIE_NAME = "admin_session";
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8; // 8h

// ── helpers ──────────────────────────────────────────────────────────────────

function safeCompare(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) {
      timingSafeEqual(ba, Buffer.alloc(ba.length));
      return false;
    }
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Read the admin token from request headers or cookie.
 * Primary:  x-admin-token header
 * Cookie:   admin_token httpOnly (posé par POST /api/admin/auth/login)
 * @pr4:compat-removed — x-interligens-api-token supprimé (token Vercel retiré 2026-03-15)
 */
export function getAdminTokenFromReq(req: NextRequest): string | null {
  const primary = req.headers.get("x-admin-token");
  if (primary) return primary;

  // Cookie httpOnly posé par POST /api/admin/auth/login
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (cookie) return cookie;

  return null;
}

/** Returns true if the request carries a valid admin token. */
export function isAdminApi(req: NextRequest): boolean {
  const envToken = process.env.ADMIN_TOKEN;
  if (!envToken) return false;

  const provided = getAdminTokenFromReq(req);
  if (!provided) return false;

  return safeCompare(provided, envToken);
}

/**
 * Asserts ADMIN_TOKEN is set in production.
 * Throws a descriptive Error if missing (caught → clear 500, NOT silent).
 */
export function assertProdEnv(): void {
  if (process.env.NODE_ENV === "production" && !process.env.ADMIN_TOKEN) {
    throw new Error(
      "[INTERLIGENS] FATAL: ADMIN_TOKEN is not set in production. " +
        "Set it in Vercel → Settings → Environment Variables.",
    );
  }
}

/**
 * Safe 500 response for missing ADMIN_TOKEN in production.
 * Use in route handlers that call assertProdEnv() in a try/catch.
 */
export function prodEnvErrorResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "Admin token missing in production env",
      detail: "Set ADMIN_TOKEN in Vercel → Settings → Environment Variables.",
    },
    { status: 500 },
  );
}

/**
 * requireAdminApi(req)
 *
 * Use at the top of every /api/admin/* route handler.
 * Returns a NextResponse (401/403/500) if auth fails, null if OK.
 *
 * Usage:
 *   const deny = requireAdminApi(req);
 *   if (deny) return deny;
 */
export function requireAdminApi(req: NextRequest): NextResponse | null {
  const envToken = process.env.ADMIN_TOKEN;

  if (!envToken) {
    return NextResponse.json(
      {
        error: "Server misconfiguration",
        detail:
          "ADMIN_TOKEN is not configured. Contact the server administrator.",
      },
      { status: 500 },
    );
  }

  const provided = getAdminTokenFromReq(req);

  if (!provided) {
    return NextResponse.json(
      { error: "Unauthorized", detail: "Missing x-admin-token header." },
      { status: 401 },
    );
  }

  if (!safeCompare(provided, envToken)) {
    return NextResponse.json(
      { error: "Forbidden", detail: "Invalid admin token." },
      { status: 403 },
    );
  }

  return null;
}

// ── Cookie management (server-side only) ─────────────────────────────────────

/**
 * Pose le cookie admin_token httpOnly sur une NextResponse existante.
 * Appeler uniquement dans POST /api/admin/auth/login.
 */
export function setAdminCookie(res: NextResponse): void {
  const token = process.env.ADMIN_TOKEN;
  if (!token) throw new Error("[adminAuth] ADMIN_TOKEN manquant — impossible de créer le cookie");
  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ADMIN_COOKIE_MAX_AGE,
    path: "/",
  });
}

/**
 * Supprime le cookie admin_token.
 * Appeler dans POST /api/admin/auth/logout.
 */
export function clearAdminCookie(res: NextResponse): void {
  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
}

// ── Admin session cookie — HMAC-signed proof-of-knowledge ───────────────────
//
// Replaces the HTTP Basic Auth prompt for browser-facing /admin/* routes.
// The cookie value is HMAC-SHA256(ADMIN_BASIC_PASS, ADMIN_TOKEN) — so anyone
// in possession of the Basic Auth password can mint the cookie, and the
// server can verify it deterministically without storing session state.
// ADMIN_TOKEN is used as the signing key so the cookie can't be forged
// without knowing both secrets.

/**
 * Compute the admin session token for the current environment. Returns null
 * if either ADMIN_BASIC_PASS or ADMIN_TOKEN is missing — callers must treat
 * this as "admin session impossible, deny".
 */
export function computeAdminSessionToken(): string | null {
  const pass = process.env.ADMIN_BASIC_PASS;
  const secret = process.env.ADMIN_TOKEN;
  if (!pass || !secret) return null;
  return createHmac("sha256", secret).update(pass).digest("hex");
}

/** Constant-time hex string compare. */
function safeCompareHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) {
      timingSafeEqual(ba, Buffer.alloc(ba.length));
      return false;
    }
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Read the admin session cookie and verify its HMAC against the env. */
export function verifyAdminSession(req: NextRequest): boolean {
  const provided = req.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value ?? null;
  if (!provided) return false;
  const expected = computeAdminSessionToken();
  if (!expected) return false;
  return safeCompareHex(provided, expected);
}

/**
 * Server-component flavour of {@link verifyAdminSession}. Reads the
 * admin_session cookie via next/headers and checks its HMAC — same
 * semantics, no NextRequest required.
 *
 * Used by non-admin server surfaces (e.g. investigator layouts) that need
 * to detect an admin founder and bypass their own onboarding gates.
 */
export async function isAdminSessionFromCookies(): Promise<boolean> {
  // Import lazily so this module stays importable from anywhere (middleware,
  // API routes, server components). next/headers only works in server runtime.
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const provided = store.get(ADMIN_SESSION_COOKIE_NAME)?.value ?? null;
  if (!provided) return false;
  const expected = computeAdminSessionToken();
  if (!expected) return false;
  return safeCompareHex(provided, expected);
}

/**
 * Set the admin session cookie on an existing response. Caller must have
 * verified the user's password already. Does nothing if env is misconfigured.
 */
export function setAdminSessionCookie(res: NextResponse): boolean {
  const token = computeAdminSessionToken();
  if (!token) return false;
  res.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: "/",
  });
  return true;
}

/** Clear the admin session cookie. Used by logout. */
export function clearAdminSessionCookie(res: NextResponse): void {
  res.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
}

/**
 * Gate helper for admin PAGE server components. Returns a redirect response
 * to /admin/login when no valid admin_session cookie is present; returns
 * null when the session is valid and the page should render.
 */
export function requireAdminCookie(req: NextRequest): NextResponse | null {
  if (verifyAdminSession(req)) return null;
  const loginUrl = new URL("/admin/login", req.url);
  loginUrl.searchParams.set("redirect", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
