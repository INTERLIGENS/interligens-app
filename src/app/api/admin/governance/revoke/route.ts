// ─── POST /api/admin/governance/revoke ────────────────────────────────────
// Body: { entityType, entityValue, reason }

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/middleware/adminAuth";
import {
  adminRevokeGovernedStatus,
  AdminGovernanceError,
} from "@/lib/admin/governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RevokeBody {
  entityType?: string;
  entityValue?: string;
  reason?: string;
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: RevokeBody;
  try {
    body = (await req.json()) as RevokeBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.entityType || !body.entityValue || !body.reason) {
    return NextResponse.json(
      { error: "missing_fields", required: ["entityType", "entityValue", "reason"] },
      { status: 400 },
    );
  }

  const token = req.headers.get("x-admin-token") ?? "anonymous";
  const actor = { userId: `admin:${token.slice(0, 8)}`, role: "admin" };

  try {
    const record = await adminRevokeGovernedStatus(
      body.entityType,
      body.entityValue,
      body.reason,
      actor,
    );
    return NextResponse.json({ ok: true, record });
  } catch (err) {
    if (err instanceof AdminGovernanceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    console.error("[admin/governance/revoke] unexpected", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
