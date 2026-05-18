// src/app/api/admin/kol/sync-proceeds/route.ts
//
// POST /api/admin/kol/sync-proceeds           — sync every KolProfile
// POST /api/admin/kol/sync-proceeds?handle=X  — sync one handle
//
// Recomputes KolProfile.totalDocumented from the authoritative
// SUM("amountUsd") in KolProceedsEvent. This is what the public Explorer
// reads; the prior enrichment path (KolEvidence.amountUsd) ignored the
// on-chain events written by the Helius scan, leaving the public counters
// stuck at historical values.
//
// Pure data reconciliation — does NOT call Helius, does NOT insert events.
// The Helius scan itself lives in /api/cron/helius-scan and is scheduled
// every 12h (vercel.json).

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Row = {
  handle: string;
  before: number | null;
  after: number;
  delta: number;
  events: number;
};

async function syncHandle(handle: string): Promise<Row> {
  const rows = await prisma.$queryRaw<
    { total: number | null; events: bigint }[]
  >`
    SELECT COALESCE(SUM("amountUsd"), 0)::float AS total,
           COUNT(*)::bigint AS events
    FROM "KolProceedsEvent"
    WHERE "kolHandle" = ${handle}
      AND "ambiguous" = false AND "amountUsd" > 0
  `;
  const after = Number(rows[0]?.total ?? 0);
  const events = Number(rows[0]?.events ?? 0n);

  const current = await prisma.kolProfile.findUnique({
    where: { handle },
    select: { totalDocumented: true },
  });

  await prisma.kolProfile.update({
    where: { handle },
    data: { totalDocumented: Math.round(after) },
  });

  const before = current?.totalDocumented ?? null;
  return {
    handle,
    before,
    after: Math.round(after),
    delta: Math.round(after - (before ?? 0)),
    events,
  };
}

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const handle = searchParams.get("handle")?.trim();

  if (handle) {
    const profile = await prisma.kolProfile.findUnique({
      where: { handle },
      select: { handle: true },
    });
    if (!profile)
      return NextResponse.json({ error: "handle not found" }, { status: 404 });
    const row = await syncHandle(handle);
    return NextResponse.json({ count: 1, rows: [row] });
  }

  // Only handles that have at least one KolProceedsEvent row — saves cycles
  // on profiles with no on-chain data. Others keep their existing value.
  const handles = await prisma.$queryRaw<{ kolHandle: string }[]>`
    SELECT DISTINCT "kolHandle" FROM "KolProceedsEvent"
  `;

  const rows: Row[] = [];
  for (const h of handles) {
    try {
      rows.push(await syncHandle(h.kolHandle));
    } catch (err) {
      rows.push({
        handle: h.kolHandle,
        before: null,
        after: 0,
        delta: 0,
        events: 0,
      });
    }
  }

  const totalBefore = rows.reduce((s, r) => s + (r.before ?? 0), 0);
  const totalAfter = rows.reduce((s, r) => s + r.after, 0);

  return NextResponse.json({
    count: rows.length,
    totalBefore,
    totalAfter,
    totalDelta: totalAfter - totalBefore,
    rows: rows.sort((a, b) => b.after - a.after),
  });
}

export async function GET(req: NextRequest) {
  // Dry-run: report what the sync would set, without mutating anything.
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const rows = await prisma.$queryRaw<
    { handle: string; before: number | null; after: number; events: bigint }[]
  >`
    SELECT k.handle,
           k."totalDocumented" AS before,
           COALESCE(SUM(e."amountUsd"), 0)::float AS after,
           COUNT(e.id)::bigint AS events
    FROM "KolProfile" k
    JOIN "KolProceedsEvent" e ON e."kolHandle" = k.handle
    WHERE e."ambiguous" = false AND e."amountUsd" > 0
    GROUP BY k.handle, k."totalDocumented"
    ORDER BY after DESC NULLS LAST
  `;
  const out = rows.map((r) => ({
    handle: r.handle,
    before: r.before,
    after: Math.round(r.after),
    delta: Math.round(r.after - (r.before ?? 0)),
    events: Number(r.events),
  }));
  return NextResponse.json({
    dryRun: true,
    count: out.length,
    rows: out,
  });
}
