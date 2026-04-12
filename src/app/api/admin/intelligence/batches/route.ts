// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/intelligence/batches
// List IntelIngestionBatch records with pagination.
// Auth: requireAdminApi
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  const [records, total] = await Promise.all([
    prisma.intelIngestionBatch.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.intelIngestionBatch.count(),
  ]);

  return NextResponse.json({ records, total });
}
