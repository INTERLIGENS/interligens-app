// ─── GET /api/admin/snapshots/[entityValue] ──────────────────────────────
// Returns the most recent ScoreSnapshot rows for a given entity. Admin-only.
// Query params: ?entityType=wallet|token  (default: token)
//               ?limit=20                  (default: 20, max 200)

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/middleware/adminAuth";
import { listSnapshots } from "@/lib/tigerscore/versioning";
import type { EntityType } from "@/lib/governance/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED: ReadonlySet<EntityType> = new Set([
  "wallet",
  "token",
  "domain",
  "handle",
]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entityValue: string }> },
) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { entityValue } = await params;
  if (!entityValue) {
    return NextResponse.json({ error: "entityValue_required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const entityType = (url.searchParams.get("entityType") ?? "token") as EntityType;
  if (!ALLOWED.has(entityType)) {
    return NextResponse.json(
      { error: "invalid_entityType", allowed: [...ALLOWED] },
      { status: 400 },
    );
  }
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);

  const items = await listSnapshots(
    entityType,
    entityValue,
    Number.isFinite(limit) ? limit : 20,
  );
  return NextResponse.json({
    ok: true,
    entityType,
    entityValue,
    count: items.length,
    items,
  });
}
