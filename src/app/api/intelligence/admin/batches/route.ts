// ─────────────────────────────────────────────────────────────────────────────
// Admin API — Ingestion batch history
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
  const source = url.searchParams.get("source") || undefined;

  const where: any = {};
  if (source) where.sourceSlug = source;

  const [records, total] = await Promise.all([
    prisma.intelIngestionBatch.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.intelIngestionBatch.count({ where }),
  ]);

  return NextResponse.json({ records, total, page, pageSize });
}
