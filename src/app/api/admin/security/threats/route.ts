import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { listThreats } from "@/lib/security/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;
  try {
    const threats = await listThreats();
    return NextResponse.json({ threats });
  } catch (err) {
    console.warn("[admin/security/threats] failed", err);
    return NextResponse.json({ threats: [], pending: true });
  }
}
