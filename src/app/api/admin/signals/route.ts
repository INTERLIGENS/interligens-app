/**
 * src/app/api/admin/signals/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const severity = searchParams.get("severity") ?? undefined;
  const influencerId = searchParams.get("influencerId") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 25;

  const where: any = { type: "SELL_WHILE_SHILLING" };
  if (severity) where.severity = severity;
  if (influencerId) where.influencerId = influencerId;

  const [total, signals] = await Promise.all([
    prisma.signal.count({ where }),
    prisma.signal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        influencer: { select: { handle: true } },
        socialPost: {
          select: {
            postUrl: true,
            capturedAtUtc: true,
            manifestSha256: true,
            textExcerpt: true,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({ signals, total, page, pages: Math.ceil(total / limit) });
}
