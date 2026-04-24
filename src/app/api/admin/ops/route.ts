// src/app/api/admin/ops/route.ts
// GET  — ops metrics dashboard
// POST — actions: { action: "revive_dead_letters" }

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    deStatuses,
    deLast24h,
    ijStatuses,
    ijLast24h,
    lastRecomputes,
    snapshotCounts,
    proceedsRow,
  ] = await Promise.all([
    // DomainEvent counts by status
    prisma.domainEvent.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    // DomainEvent last 24h
    prisma.domainEvent.count({ where: { createdAt: { gte: since24h } } }),
    // IngestionJob counts by status
    prisma.ingestionJob.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    // IngestionJob last 24h
    prisma.ingestionJob.count({ where: { createdAt: { gte: since24h } } }),
    // Top 10 handles by most recent Helius scan
    prisma.kolProfile.findMany({
      where: { lastHeliusScan: { not: null } },
      select: { handle: true, lastHeliusScan: true, totalDocumented: true },
      orderBy: { lastHeliusScan: "desc" },
      take: 10,
    }),
    // Snapshot freshness: count fresh (<24h) vs stale
    Promise.all([
      prisma.kolProfile.count({ where: { lastHeliusScan: { gte: since24h } } }),
      prisma.kolProfile.count({ where: { OR: [{ lastHeliusScan: null }, { lastHeliusScan: { lt: since24h } }] } }),
    ]),
    // Total proceeds across all published profiles
    prisma.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM("totalDocumented"), 0)::float AS total
      FROM "KolProfile"
      WHERE "publishStatus" = 'published'
    `,
  ]);

  const deCounts = Object.fromEntries(deStatuses.map(r => [r.status, r._count.id]));
  const ijCounts = Object.fromEntries(ijStatuses.map(r => [r.status, r._count.id]));

  return NextResponse.json({
    domainEvents: {
      pending: deCounts["pending"] ?? 0,
      processing: deCounts["processing"] ?? 0,
      failed: deCounts["failed"] ?? 0,
      dead_letter: deCounts["dead_letter"] ?? 0,
      last24h: deLast24h,
    },
    ingestionJobs: {
      pending: ijCounts["pending"] ?? 0,
      computed: ijCounts["computed"] ?? 0,
      published: ijCounts["published"] ?? 0,
      failed: ijCounts["failed"] ?? 0,
      last24h: ijLast24h,
    },
    lastRecomputes: lastRecomputes.map(r => ({
      handle: r.handle,
      lastRecomputeAt: r.lastHeliusScan,
      totalDocumented: r.totalDocumented ?? 0,
    })),
    snapshotHealth: {
      fresh: snapshotCounts[0],
      stale: snapshotCounts[1],
    },
    proceedsTotal: proceedsRow[0]?.total ?? 0,
    generatedAt: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: { action?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (body.action === "revive_dead_letters") {
    const result = await prisma.domainEvent.updateMany({
      where: { status: "dead_letter" },
      data: { status: "pending", retryCount: 0, deadLetteredAt: null, nextRetryAt: null, error: null },
    });
    return NextResponse.json({ revived: result.count });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
