// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/security/adminAuth";

export const runtime = "nodejs";

const isProd = process.env.NODE_ENV === "production";

function basicAuthFail() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="INTERLIGENS Admin"' },
  });
}

function checkBasicAuth(req: NextRequest): boolean {
  const user = process.env.ADMIN_BASIC_USER;
  const pass = process.env.ADMIN_BASIC_PASS;
  if (!user || !pass) return false;
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Basic ")) return false;
  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
  const [u, ...rest] = decoded.split(":");
  return u === user && rest.join(":") === pass;
}

function redirectToAdminLogin(req: NextRequest) {
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.search = `?redirect=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(loginUrl);
}

// ── Beta session check ─────────────────────────────────────────────────────
// All public-facing demo pages require a valid beta session (fail-closed).
// The session cookie is the same used by the investigator system.

const BETA_COOKIE = "investigator_session";

/** Routes that are NEVER gated (access flow, API, static, health). */
function isBetaExempt(pathname: string): boolean {
  // Access / auth flow
  if (pathname.startsWith("/access")) return true;
  // Simulator (educational prototype — no backend, no data)
  if (pathname === "/simulator" || pathname.startsWith("/simulator/")) return true;
  // API routes have their own per-route guards
  if (pathname.startsWith("/api/")) return true;
  // Admin has its own basic auth
  if (pathname.startsWith("/admin")) return true;
  // Next.js internals & static assets
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  // Health check
  if (pathname === "/health") return true;
  // SEO: sitemap + robots must be crawler-accessible (P1)
  if (pathname === "/sitemap.xml") return true;
  if (pathname === "/robots.txt") return true;
  return false;
}

/**
 * SEC-003 — matches /admin, /api/admin, AND /en/admin, /fr/admin, /[locale]/admin.
 * Previously only /admin/* was checked, leaving /en/admin/graph unprotected.
 */
function isLocalizedAdminRoute(pathname: string): boolean {
  return /^\/[a-z]{2}\/admin(\/|$)/.test(pathname);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Admin routes — cookie session (pages) / basic-or-cookie (APIs) ─────
  // Exempt: the login page itself + the login/logout API endpoints must be
  // reachable without auth, otherwise the user can never obtain a cookie.
  const isAdminLoginSurface =
    pathname === "/admin/login" ||
    pathname.startsWith("/api/admin/auth/login") ||
    pathname.startsWith("/api/admin/auth/logout");

  const isAdminPageRoute =
    !isAdminLoginSurface &&
    (pathname.startsWith("/admin") || isLocalizedAdminRoute(pathname)) &&
    !pathname.startsWith("/api/");

  const isAdminApiRoute =
    !isAdminLoginSurface && pathname.startsWith("/api/admin");

  if (isProd && isAdminPageRoute) {
    // Browser pages: ONLY accept the admin_session cookie. No more Basic
    // Auth prompt — the user signs in at /admin/login and gets a cookie.
    if (!verifyAdminSession(req)) {
      return redirectToAdminLogin(req);
    }
  }

  if (isProd && isAdminApiRoute) {
    // API routes: accept either the admin_session cookie (so internal
    // fetches from the admin UI keep working) or Basic Auth (legacy curl
    // scripts still work). Route handlers then layer requireAdminApi on
    // top to validate the x-admin-token header when present.
    const ok = verifyAdminSession(req) || checkBasicAuth(req);
    if (!ok) return basicAuthFail();
  }

  // ── Investigator routes — session cookie presence check (UX gate) ──────
  // Full DB session validation happens in API route handlers.
  const isInvestigatorPage =
    pathname.startsWith("/en/investigator") &&
    !pathname.startsWith("/en/investigator/login");
  const isInvestigatorApi =
    pathname.startsWith("/api/investigator") &&
    !pathname.startsWith("/api/investigator/auth");

  if (isInvestigatorPage || isInvestigatorApi) {
    const hasSession = !!req.cookies.get(BETA_COOKIE)?.value;
    if (!hasSession) {
      if (isInvestigatorApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/access";
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Beta gating — all public demo pages ────────────────────────────────
  // Fail-closed: if not exempt, must have a session cookie.
  if (!isBetaExempt(pathname)) {
    const hasSession = !!req.cookies.get(BETA_COOKIE)?.value;
    if (!hasSession) {
      const accessUrl = req.nextUrl.clone();
      accessUrl.pathname = "/access";
      return NextResponse.redirect(accessUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Admin
    "/admin/:path*",
    "/api/admin/:path*",
    // Investigator
    "/en/investigator/:path*",
    "/api/investigator/:path*",
    // Beta gating — all locale pages + root
    "/",
    "/en/:path*",
    "/fr/:path*",
    // Dynamic locale
    "/((?!_next|favicon|access|api|admin|health|sitemap.xml|robots.txt).*)",
  ],
};
