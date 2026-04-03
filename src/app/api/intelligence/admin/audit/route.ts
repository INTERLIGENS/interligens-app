// ─────────────────────────────────────────────────────────────────────────────
// Admin API — Audit log viewer
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = 50;
  const action = url.searchParams.get("action") || undefined;

  const where: any = {};
  if (action) where.action = action;

  const [records, total] = await Promise.all([
    prisma.intelAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.intelAuditLog.count({ where }),
  ]);

  return NextResponse.json({ records, total, page, pageSize });
}
