/**
 * src/app/api/admin/onchain/sync/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { incrementalSync } from "@/lib/surveillance/onchain/ingest";

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;
  const result = await incrementalSync();
  return NextResponse.json(result);
}
