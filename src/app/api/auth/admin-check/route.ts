// ─── GET /api/auth/admin-check ───────────────────────────────────────────
// Public endpoint that returns { isAdmin: boolean } based on the
// admin_session cookie. Used by investigator client components
// (box/page.tsx, VaultGate.tsx) to detect an admin founder session and
// skip the investigator onboarding / NDA flow.
//
// Leaks nothing a navigator can't already infer by observing redirects.
// Placed outside /api/admin/ on purpose so the middleware's admin gate
// doesn't block unauthenticated callers — the whole point is to let a
// non-admin caller see `isAdmin: false` without a 401.

import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminSession } from "@/lib/security/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return NextResponse.json({ isAdmin: verifyAdminSession(req) });
}
