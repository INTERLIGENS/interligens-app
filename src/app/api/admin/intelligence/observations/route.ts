// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/intelligence/observations
// List SourceObservation records, optionally filtered by entityId.
// Auth: requireAdminApi
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const url = new URL(req.url);
  const entityId = url.searchParams.get("entityId") || undefined;
  const sourceSlug = url.searchParams.get("sourceSlug") || undefined;
  const activeOnly = url.searchParams.get("activeOnly") !== "false";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const where: Record<string, unknown> = {};
  if (entityId) where.entityId = entityId;
  if (sourceSlug) where.sourceSlug = sourceSlug;
  if (activeOnly) where.listIsActive = true;

  const [observations, total] = await Promise.all([
    prisma.sourceObservation.findMany({
      where,
      include: {
        entity: {
          select: { id: true, type: true, value: true, riskClass: true },
        },
      },
      orderBy: { ingestedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.sourceObservation.count({ where }),
  ]);

  return NextResponse.json({ observations, total, limit, offset });
}
