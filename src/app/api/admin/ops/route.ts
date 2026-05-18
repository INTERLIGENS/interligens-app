// src/app/api/admin/ops/route.ts
// GET  — ops metrics dashboard
// POST — actions: requeue_event | requeue_batch | archive_event | ignore_event | revive_dead_letters

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
    deadLetters,
  ] = await Promise.all([
    prisma.domainEvent.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.domainEvent.count({ where: { createdAt: { gte: since24h } } }),
    prisma.ingestionJob.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.ingestionJob.count({ where: { createdAt: { gte: since24h } } }),
    prisma.kolProfile.findMany({
      where: { lastHeliusScan: { not: null } },
      select: { handle: true, lastHeliusScan: true, totalDocumented: true },
      orderBy: { lastHeliusScan: "desc" },
      take: 10,
    }),
    Promise.all([
      prisma.kolProfile.count({ where: { lastHeliusScan: { gte: since24h } } }),
      prisma.kolProfile.count({ where: { OR: [{ lastHeliusScan: null }, { lastHeliusScan: { lt: since24h } }] } }),
    ]),
    prisma.$queryRaw<{ total: number }[]>`
      SELECT COALESCE(SUM("totalDocumented"), 0)::float AS total
      FROM "KolProfile" WHERE "publishStatus" = 'published'
    `,
    // Dead letters: last 50 for UI display
    prisma.domainEvent.findMany({
      where: { status: "dead_letter" },
      orderBy: { deadLetteredAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        status: true,
        error: true,
        retryCount: true,
        deadLetteredAt: true,
        createdAt: true,
        payload: true,
      },
    }),
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
    deadLetters: deadLetters.map(d => ({
      id: d.id,
      type: d.type,
      error: d.error ?? null,
      retryCount: d.retryCount,
      deadLetteredAt: d.deadLetteredAt,
      createdAt: d.createdAt,
      payloadPreview: JSON.stringify(d.payload).slice(0, 120),
    })),
    generatedAt: new Date().toISOString(),
  });
}

type PostBody = {
  action?: string;
  eventId?: string;
  eventType?: string;
  limit?: number;
};

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let body: PostBody;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { action, eventId, eventType, limit } = body;

  // ── requeue_event ──────────────────────────────────────────────────────────
  if (action === "requeue_event") {
    if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });
    const event = await prisma.domainEvent.findUnique({ where: { id: eventId } });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    await prisma.domainEvent.update({
      where: { id: eventId },
      data: {
        status: "pending",
        retryCount: 0,
        nextRetryAt: null,
        deadLetteredAt: null,
        error: `[manual requeue by admin] ${new Date().toISOString()}`,
      },
    });
    return NextResponse.json({ ok: true, action, eventId });
  }

  // ── requeue_batch ──────────────────────────────────────────────────────────
  if (action === "requeue_batch") {
    const batchLimit = Math.min(limit ?? 10, 10);
    const where = {
      status: "dead_letter",
      ...(eventType ? { type: eventType } : {}),
    };

    // Preview mode: if limit > 5 and no explicit confirmation
    if (batchLimit > 5 && body.limit !== undefined) {
      const preview = await prisma.domainEvent.findMany({
        where,
        take: batchLimit,
        select: { id: true, type: true, error: true, deadLetteredAt: true },
      });
      return NextResponse.json({ preview, requiresConfirmation: true, count: preview.length });
    }

    const events = await prisma.domainEvent.findMany({ where, take: batchLimit, select: { id: true } });
    if (events.length === 0) return NextResponse.json({ ok: true, action, requeued: 0 });

    await prisma.domainEvent.updateMany({
      where: { id: { in: events.map(e => e.id) } },
      data: {
        status: "pending",
        retryCount: 0,
        nextRetryAt: null,
        deadLetteredAt: null,
        error: `[batch requeue by admin] ${new Date().toISOString()}`,
      },
    });
    return NextResponse.json({ ok: true, action, requeued: events.length, eventType: eventType ?? "all" });
  }

  // ── archive_event ──────────────────────────────────────────────────────────
  if (action === "archive_event") {
    if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });
    await prisma.domainEvent.update({
      where: { id: eventId },
      data: { status: "archived" },
    });
    return NextResponse.json({ ok: true, action, eventId });
  }

  // ── ignore_event ───────────────────────────────────────────────────────────
  if (action === "ignore_event") {
    if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });
    await prisma.domainEvent.update({
      where: { id: eventId },
      data: { status: "ignored" },
    });
    return NextResponse.json({ ok: true, action, eventId });
  }

  // ── legacy: revive_dead_letters ────────────────────────────────────────────
  if (action === "revive_dead_letters") {
    const result = await prisma.domainEvent.updateMany({
      where: { status: "dead_letter" },
      data: { status: "pending", retryCount: 0, deadLetteredAt: null, nextRetryAt: null, error: null },
    });
    return NextResponse.json({ revived: result.count });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
