// ─── /api/admin/governance — list + set governed status ──────────────────
// Admin-only. Uses the unified requireAdminApi helper so the auth rules
// stay consistent with every other /api/admin route in the codebase.
//
// GET  /api/admin/governance?status=...&entityType=...&limit=...
// POST /api/admin/governance  (body: AdminSetStatusInput)

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/middleware/adminAuth";
import {
  adminListGovernedStatus,
  adminSetGovernedStatus,
  AdminGovernanceError,
} from "@/lib/admin/governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function actorFromReq(req: NextRequest): { userId: string; role: string } {
  // The admin token doubles as an actor identifier for audit logs. For
  // richer role-based audit we can later layer session cookies on top.
  const token = req.headers.get("x-admin-token") ?? "anonymous";
  return {
    userId: `admin:${token.slice(0, 8)}`,
    role: "admin",
  };
}

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const url = new URL(req.url);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  const includeRevoked = url.searchParams.get("includeRevoked") === "1";

  try {
    const result = await adminListGovernedStatus({
      status: url.searchParams.get("status") ?? undefined,
      entityType: url.searchParams.get("entityType") ?? undefined,
      reviewState: url.searchParams.get("reviewState") ?? undefined,
      chain: url.searchParams.get("chain") ?? undefined,
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
      includeRevoked,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof AdminGovernanceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    console.error("[admin/governance GET] unexpected", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const record = await adminSetGovernedStatus(
      body as Parameters<typeof adminSetGovernedStatus>[0],
      actorFromReq(req),
    );
    return NextResponse.json({ ok: true, record }, { status: 201 });
  } catch (err) {
    if (err instanceof AdminGovernanceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    console.error("[admin/governance POST] unexpected", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
