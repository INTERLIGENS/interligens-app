// ─────────────────────────────────────────────────────────────────────────────
// Admin API — CaseRecord list
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
  const status = url.searchParams.get("status") || undefined;
  const caseType = url.searchParams.get("type") || undefined;

  const where: any = {};
  if (status) where.status = status;
  if (caseType) where.caseType = caseType;

  const [records, total] = await Promise.all([
    prisma.caseRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { entities: true, evidence: true } },
      },
    }),
    prisma.caseRecord.count({ where }),
  ]);

  return NextResponse.json({ records, total, page, pageSize });
}
