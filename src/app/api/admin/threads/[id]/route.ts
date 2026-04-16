import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { id } = await ctx.params;
  const thread = await prisma.xThread.findUnique({ where: { id } });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ thread });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title;
  if (typeof body.body === "string") data.body = body.body;
  if (typeof body.target === "string") data.target = body.target || null;
  if (typeof body.status === "string") data.status = body.status;
  if (body.scheduledAt !== undefined) data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (body.publishedAt !== undefined) data.publishedAt = body.publishedAt ? new Date(body.publishedAt) : null;
  if (typeof body.tweetUrl === "string") data.tweetUrl = body.tweetUrl || null;
  if (typeof body.impressions === "number") data.impressions = body.impressions;
  if (typeof body.retweets === "number") data.retweets = body.retweets;
  if (typeof body.likes === "number") data.likes = body.likes;

  const thread = await prisma.xThread.update({ where: { id }, data });
  return NextResponse.json({ thread });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { id } = await ctx.params;
  await prisma.xThread.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
