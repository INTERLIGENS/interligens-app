/**
 * src/app/api/admin/social/discover/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { discoverPosts } from "@/lib/surveillance/social/jobs";

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;
  const result = await discoverPosts();
  return NextResponse.json(result);
}
