import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const status   = searchParams.get("status") ?? undefined;
  const priority = searchParams.get("priority") ?? undefined;
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit    = 25;

  const where: Record<string, unknown> = {};
  if (status)   where.status   = status;
  if (priority) where.priority = priority;

  const [total, campaigns] = await Promise.all([
    prisma.watcherCampaign.count({ where }),
    prisma.watcherCampaign.findMany({
      where,
      include: {
        campaignKols: {
          select: { kolHandle: true, signalCount: true },
          orderBy: { signalCount: "desc" },
          take: 6,
        },
      },
      orderBy: [{ lastSeenAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  // Sort in memory by priority then lastSeenAt
  const sorted = campaigns.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 9;
    const pb = PRIORITY_ORDER[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return b.lastSeenAt.getTime() - a.lastSeenAt.getTime();
  });

  return NextResponse.json({
    campaigns: sorted,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

export async function PATCH(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const { id, status } = body as { id?: string; status?: string };

  if (!id || !status) {
    return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
  }
  const allowed = ["ACTIVE", "WATCHING", "RESOLVED", "DISMISSED"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await prisma.watcherCampaign.update({
    where: { id },
    data: { status, updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, campaign: updated });
}
