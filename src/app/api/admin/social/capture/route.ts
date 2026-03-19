/**
 * src/app/api/admin/social/capture/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { captureCandidates } from "@/lib/surveillance/social/jobs";

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;
  const result = await captureCandidates();
  return NextResponse.json(result);
}
