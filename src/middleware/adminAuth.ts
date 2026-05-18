// ─── src/middleware/adminAuth.ts ──────────────────────────────────────────
// Thin wrapper over src/lib/security/adminAuth.ts so the hardening routes
// can depend on a stable import path (the checklist references this file).
//
// The canonical implementation lives in src/lib/security/adminAuth.ts — we
// only re-export its functions here, plus a convenience `requireAdmin(req)`
// alias that throws instead of returning a NextResponse. That matches the
// checklist API but the Next.js-idiomatic helper (returns a 401/403 response
// rather than throwing) is `requireAdminApi` and is what route handlers
// should use in production.

import { NextRequest } from "next/server";
import {
  requireAdminApi,
  isAdminApi,
  getAdminTokenFromReq,
  assertProdEnv,
} from "@/lib/security/adminAuth";

export { requireAdminApi, isAdminApi, getAdminTokenFromReq, assertProdEnv };

/**
 * Throws "Unauthorized" when the request does not carry a valid admin token.
 * Prefer {@link requireAdminApi} inside route handlers — it returns a proper
 * NextResponse (401/403) rather than throwing.
 */
export function requireAdmin(req: NextRequest): void {
  if (!isAdminApi(req)) {
    throw new Error("Unauthorized");
  }
}
