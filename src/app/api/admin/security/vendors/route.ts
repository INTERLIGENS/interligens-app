import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { listVendors } from "@/lib/security/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;
  try {
    const vendors = await listVendors();
    return NextResponse.json({ vendors });
  } catch (err) {
    console.warn("[admin/security/vendors] failed", err);
    return NextResponse.json({ vendors: [], pending: true });
  }
}
