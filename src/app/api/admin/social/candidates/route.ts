/**
 * src/app/api/admin/social/candidates/route.ts
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 25;

  const where = status ? { status } : {};

  const [total, candidates] = await Promise.all([
    prisma.socialPostCandidate.count({ where }),
    prisma.socialPostCandidate.findMany({
      where,
      orderBy: { discoveredAtUtc: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { influencer: { select: { handle: true } } },
    }),
  ]);

  return NextResponse.json({ candidates, total, page, pages: Math.ceil(total / limit) });
}
