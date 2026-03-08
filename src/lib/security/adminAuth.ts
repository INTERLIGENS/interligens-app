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

import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
 * Read the admin token from request headers.
 * Primary:  x-admin-token
 * Compat:   x-interligens-api-token (deprecated, remove after 2025-06-01)
 */
export function getAdminTokenFromReq(req: NextRequest): string | null {
  const primary = req.headers.get("x-admin-token");
  if (primary) return primary;

  const legacy = req.headers.get("x-interligens-api-token");
  if (legacy) {
    console.warn(
      "[adminAuth] DEPRECATION WARNING: x-interligens-api-token is deprecated. " +
        "Migrate to x-admin-token before 2026-03-15.",
    );
    // Fire-and-forget AuditLog (no IP, no secret value)
    prisma.auditLog.create({
      data: {
        action: "LEGACY_TOKEN_USED",
        actorId: "system",
        meta: "x-interligens-api-token header used — migrate to x-admin-token",
      },
    }).catch(() => { /* non-blocking */ });
    return legacy;
  }

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
