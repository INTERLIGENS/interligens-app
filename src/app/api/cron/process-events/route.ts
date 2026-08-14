// src/app/api/cron/process-events/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processEvent } from "@/lib/events/processor";
import { alertEventBacklog, alertIdentityBacklog } from "@/lib/ops/alerting";
import { HUMAN_REVIEW_TYPES } from "@/lib/events/processor";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 50;

// Gate cron FAIL-CLOSED en temps constant, aligné sur les 19 autres crons du
// repo. La garde `!process.env.CRON_SECRET` était déjà là (la route ne s'ouvrait
// pas quand le secret manquait) ; c'est la comparaison qui restait naïve.
function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const pending = await prisma.domainEvent.findMany({
    where: {
      status: "pending",
      // Les événements en attente d'arbitrage humain restent `pending` par
      // conception (voir HUMAN_REVIEW_TYPES). Sans cette exclusion ils
      // rempliraient le batch de 50 à chaque passage et affameraient les
      // événements réellement traitables — le backlog d'identité au
      // 2026-08-14 (160 lignes) dépasse à lui seul la taille du batch.
      type: { notIn: [...HUMAN_REVIEW_TYPES] },
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
