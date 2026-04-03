// ─────────────────────────────────────────────────────────────────────────────
// Admin API — Case Intelligence overview + ingest trigger
// GET  → dashboard stats
// POST → trigger ingest for one source or all
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { ingestSource, ingestAll, SOURCES } from "@/lib/intelligence";
import type { SourceSlug } from "@/lib/intelligence";

// ── GET: dashboard stats ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const [
    entityCount,
    sanctionCount,
    highCount,
    observationCount,
    caseCount,
    batchCount,
    recentBatches,
  ] = await Promise.all([
    prisma.canonicalEntity.count({ where: { isActive: true } }),
    prisma.canonicalEntity.count({
      where: { isActive: true, riskClass: "SANCTION" },
    }),
    prisma.canonicalEntity.count({
      where: { isActive: true, riskClass: "HIGH" },
    }),
    prisma.sourceObservation.count({ where: { listIsActive: true } }),
    prisma.caseRecord.count(),
    prisma.intelIngestionBatch.count(),
    prisma.intelIngestionBatch.findMany({
      orderBy: { startedAt: "desc" },
      take: 6,
    }),
  ]);

  // Source status summary
  const sourceStatus = await Promise.all(
    Object.values(SOURCES).map(async (src) => {
      const lastBatch = await prisma.intelIngestionBatch.findFirst({
        where: { sourceSlug: src.slug },
        orderBy: { startedAt: "desc" },
      });
      const entityCount = await prisma.sourceObservation.count({
        where: { sourceSlug: src.slug, listIsActive: true },
      });
      return {
        ...src,
        lastBatch: lastBatch
          ? {
              id: lastBatch.id,
              status: lastBatch.status,
              startedAt: lastBatch.startedAt,
              completedAt: lastBatch.completedAt,
              recordsFetched: lastBatch.recordsFetched,
              recordsNew: lastBatch.recordsNew,
            }
          : null,
        entityCount,
      };
    })
  );

  return NextResponse.json({
    entities: { total: entityCount, sanction: sanctionCount, high: highCount },
    observations: observationCount,
    cases: caseCount,
    batches: batchCount,
    recentBatches,
    sources: sourceStatus,
  });
}

// ── POST: trigger ingest ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const slug = body.source as string | undefined;
  const triggeredBy = `admin:manual`;

  if (slug && slug !== "all") {
    if (!(slug in SOURCES)) {
      return NextResponse.json(
        { error: `Unknown source: ${slug}` },
        { status: 400 }
      );
    }
    const result = await ingestSource(slug as SourceSlug, triggeredBy);
    return NextResponse.json(result);
  }

  const results = await ingestAll(triggeredBy);
  return NextResponse.json({ results });
}
