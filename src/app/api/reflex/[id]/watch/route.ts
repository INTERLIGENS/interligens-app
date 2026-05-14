/**
 * REFLEX V1 — POST /api/reflex/:id/watch
 *
 * Enrols the target of a ReflexAnalysis into the watch queue with a
 * TTL (default 30 days, capped at 365). The cron worker that polls
 * `nextCheckAt` is wired in a later commit; this route just persists
 * the row.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findById } from "@/lib/reflex/persistence";
import { WATCH_DEFAULT_TTL_DAYS } from "@/lib/reflex/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WatchBody {
  ttlDays?: number;
}

function pickTargetType(input: {
  chain?: string | null;
  address?: string | null;
  handle?: string | null;
  url?: string | null;
  type: string;
}): "HANDLE" | "TOKEN" | "WALLET" | "URL" {
  if (input.handle) return "HANDLE";
  if (input.url) return "URL";
  if (input.address) {
    if (input.type === "WALLET") return "WALLET";
    return "TOKEN";
  }
  return "TOKEN";
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const analysis = await findById(id);
  if (!analysis) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: WatchBody = {};
  try {
    body = (await req.json()) as WatchBody;
  } catch {
    // empty body is valid — defaults take over
  }

  const ttlDays =
    typeof body.ttlDays === "number" &&
    Number.isFinite(body.ttlDays) &&
    body.ttlDays > 0 &&
    body.ttlDays <= 365
      ? Math.floor(body.ttlDays)
      : WATCH_DEFAULT_TTL_DAYS;

  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);

  const target =
    analysis.input.address ??
    analysis.input.handle ??
    analysis.input.url ??
    analysis.input.raw;

  const watch = await prisma.reflexWatch.create({
    data: {
      reflexAnalysisId: id,
      target,
      targetType: pickTargetType({
        chain: analysis.input.chain ?? null,
        address: analysis.input.address ?? null,
        handle: analysis.input.handle ?? null,
        url: analysis.input.url ?? null,
        type: analysis.input.type,
      }),
      chain: analysis.input.chain ?? null,
      expiresAt,
      status: "ACTIVE",
    },
  });

  return NextResponse.json({
    watchId: watch.id,
    reflexAnalysisId: id,
    target: watch.target,
    targetType: watch.targetType,
    chain: watch.chain,
    expiresAt: watch.expiresAt?.toISOString() ?? null,
    status: watch.status,
  });
}
