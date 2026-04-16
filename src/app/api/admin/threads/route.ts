import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const threads = await prisma.xThread.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ threads });
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const threadBody = typeof body.body === "string" ? body.body : "";
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const thread = await prisma.xThread.create({
    data: {
      title,
      target: typeof body.target === "string" ? body.target || null : null,
      body: threadBody,
      status: body.status === "scheduled" ? "scheduled" : "draft",
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
    },
  });

  return NextResponse.json({ thread }, { status: 201 });
}
