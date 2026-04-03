// ─────────────────────────────────────────────────────────────────────────────
// Admin API — CanonicalEntity list with filters + pagination
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = 25;
  const type = url.searchParams.get("type") || undefined;
  const risk = url.searchParams.get("risk") || undefined;
  const search = url.searchParams.get("q") || undefined;
  const active = url.searchParams.get("active") !== "false";

  const where: any = { isActive: active };
  if (type) where.type = type;
  if (risk) where.riskClass = risk;
  if (search) where.value = { contains: search, mode: "insensitive" };

  const [records, total] = await Promise.all([
    prisma.canonicalEntity.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        observations: {
          select: {
            id: true,
            sourceSlug: true,
            sourceTier: true,
            riskClass: true,
            matchBasis: true,
            label: true,
            externalUrl: true,
            listIsActive: true,
            ingestedAt: true,
          },
        },
        _count: { select: { cases: true } },
      },
    }),
    prisma.canonicalEntity.count({ where }),
  ]);

  return NextResponse.json({ records, total, page, pageSize });
}
