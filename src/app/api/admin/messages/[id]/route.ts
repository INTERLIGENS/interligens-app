import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const status = typeof body.status === "string" ? body.status : "read";

  await prisma.feedbackEntry.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json({ success: true });
}
