/**
 * src/app/api/admin/evidence/capture/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { captureSocialPost } from "@/lib/surveillance/evidencePack";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const body = await req.json();
  const { handle, postUrl } = body;

  if (!handle || !postUrl) {
    return NextResponse.json(
      { error: "handle and postUrl are required" },
      { status: 400 }
    );
  }

  // Upsert influencer
  const influencer = await prisma.influencer.upsert({
    where: { handle },
    create: { handle, platform: "x" },
    update: {},
  });

  const result = await captureSocialPost(postUrl, handle, influencer.id);

  const status =
    result.status === "COMPLETED" ? 200 :
    result.status === "BLOCKED"   ? 422 : 500;

  return NextResponse.json(result, { status });
}
