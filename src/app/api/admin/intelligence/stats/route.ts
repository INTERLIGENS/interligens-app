// ─────────────────────────────────────────────────────────────────────────────
// GET/POST /api/admin/intelligence/stats
// Dashboard stats + manual ingest trigger.
// Auth: requireAdminApi (cookie or header)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { SOURCES } from "@/lib/intelligence/sources/registry";
import { ingestSource } from "@/lib/intelligence";
import type { SourceSlug } from "@/lib/intelligence";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const [entityTotal, sanctionCount, highCount, obsCount, caseCount, batchCount] =
    await Promise.all([
      prisma.canonicalEntity.count(),
      prisma.canonicalEntity.count({ where: { riskClass: "SANCTION" } }),
      prisma.canonicalEntity.count({ where: { riskClass: "HIGH" } }),
      prisma.sourceObservation.count(),
      prisma.caseRecord.count(),
      prisma.intelIngestionBatch.count(),
    ]);

  // Per-source stats
  const sources = await Promise.all(
    Object.values(SOURCES).map(async (src) => {
      const entityCount = await prisma.sourceObservation.count({
        where: { sourceSlug: src.slug },
      });
      const lastBatch = await prisma.intelIngestionBatch.findFirst({
        where: { sourceSlug: src.slug },
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          recordsFetched: true,
          recordsNew: true,
        },
      });
      return {
        slug: src.slug,
        name: src.name,
        tier: src.tier,
        jurisdiction: src.jurisdiction,
        schedule: src.schedule,
        entityTypes: src.entityTypes,
        entityCount,
        lastBatch,
      };
    })
  );

  // Recent batches
  const recentBatches = await prisma.intelIngestionBatch.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    entities: { total: entityTotal, sanction: sanctionCount, high: highCount },
    observations: obsCount,
    cases: caseCount,
    batches: batchCount,
    sources,
    recentBatches,
  });
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: { source: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = body.source;
  if (!(slug in SOURCES)) {
    return NextResponse.json(
      { error: `Unknown source: ${slug}`, validSources: Object.keys(SOURCES) },
      { status: 400 }
    );
  }

  const result = await ingestSource(slug as SourceSlug, "admin-manual");
  return NextResponse.json(result);
}
