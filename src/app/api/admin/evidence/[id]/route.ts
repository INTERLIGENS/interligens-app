import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { id } = await params;

  const post = await prisma.socialPost.findUnique({
    where: { id },
    select: {
      id: true,
      postUrl: true,
      capturedAtUtc: true,
      postedAtUtc: true,
      textExcerpt: true,
      screenshotSha256: true,
      htmlSha256: true,
      manifestSha256: true,
      storageKeys: true,
      captureStatus: true,
      errors: true,
      createdAt: true,
      influencer: { select: { handle: true, platform: true } },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(post);
}
