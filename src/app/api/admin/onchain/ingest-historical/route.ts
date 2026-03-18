/**
 * src/app/api/admin/onchain/ingest-historical/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { historicalIngest } from "@/lib/surveillance/onchain/ingest";

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;
  const result = await historicalIngest();
  return NextResponse.json(result);
}
