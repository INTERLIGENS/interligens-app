// src/app/api/cron/process-events/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processEvent } from "@/lib/events/processor";
import { alertEventBacklog, alertIdentityBacklog } from "@/lib/ops/alerting";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 50;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const pending = await prisma.domainEvent.findMany({
    where: {
      status: "pending",
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  if (pending.length === 0) {
    return NextResponse.json({ processed: 0, failed: 0 });
  }

  let processed = 0;
  let failed = 0;
  for (const event of pending) {
    try {
      await processEvent(event);
      processed++;
    } catch {
      failed++;
    }
  }

  // Backlog check: count remaining pending events after this batch
  const remainingPending = await prisma.domainEvent.count({
    where: { status: "pending", OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }] },
  });
  if (remainingPending > 50) {
    void alertEventBacklog(remainingPending);
  }

  // Identity queue check
  const identityPending = await prisma.domainEvent.count({
    where: { type: "identity.review_required", status: "pending" },
  });
  if (identityPending > 20) {
    void alertIdentityBacklog(identityPending);
  }

  return NextResponse.json({ processed, failed, total: pending.length, remainingPending, identityPending });
}
