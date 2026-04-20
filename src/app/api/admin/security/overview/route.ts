import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { getSecurityOverview } from "@/lib/security/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  try {
    const overview = await getSecurityOverview();
    return NextResponse.json({ overview });
  } catch (err) {
    console.warn("[admin/security/overview] failed — migration pending?", err);
    return NextResponse.json(
      { overview: null, pending: true, error: "migration_pending_or_db_error" },
      { status: 200 },
    );
  }
}
