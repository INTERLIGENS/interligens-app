/**
 * src/app/api/admin/shill-correlation/candidates/route.ts
 * PHASE 5 — admin-only API for the Shill Correlation review surface.
 * Shadow mode: no public exposure. Guarded by requireAdminApi.
 *
 *   GET   ?classification=&reviewStatus=&minScore=&kol=&wallet=&limit=
 *   PATCH { id, reviewStatus, notes? }   — triage a candidate
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { REVIEW_STATUSES } from "@/lib/shill-correlation/types";

const num = (d: unknown): number | null =>
  d == null ? null : Number(d as never);

function serialize(c: Record<string, unknown>) {
  return {
    ...c,
    ratioObserved: num(c.ratioObserved),
    recurrenceScore: num(c.recurrenceScore),
    specificityScore: num(c.specificityScore),
    timingScore: num(c.timingScore),
    exitScore: num(c.exitScore),
    genericSniperPenalty: num(c.genericSniperPenalty),
    correlationScore: num(c.correlationScore),
  };
}

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const sp = new URL(req.url).searchParams;
  const where: Record<string, unknown> = {};
  const classification = sp.get("classification");
  const reviewStatus = sp.get("reviewStatus");
  const kol = sp.get("kol");
  const wallet = sp.get("wallet");
  const minScore = sp.get("minScore");
  if (classification) where.classification = classification;
  if (reviewStatus) where.reviewStatus = reviewStatus;
  if (kol) where.kolHandle = { contains: kol, mode: "insensitive" };
  if (wallet) where.wallet = { contains: wallet };
  if (minScore && !Number.isNaN(Number(minScore)))
    where.correlationScore = { gte: Number(minScore) };

  const limit = Math.min(
    Math.max(parseInt(sp.get("limit") ?? "100", 10) || 100, 1),
    500,
  );

  const [rows, byClass, byReview, total] = await Promise.all([
    prisma.shillCorrelationCandidate.findMany({
      where,
      orderBy: { correlationScore: "desc" },
      take: limit,
    }),
    prisma.shillCorrelationCandidate.groupBy({
      by: ["classification"],
      _count: true,
    }),
    prisma.shillCorrelationCandidate.groupBy({
      by: ["reviewStatus"],
      _count: true,
    }),
    prisma.shillCorrelationCandidate.count(),
  ]);

  const fold = (arr: Array<{ _count: number } & Record<string, unknown>>, k: string) =>
    Object.fromEntries(arr.map((x) => [x[k], x._count]));

  return NextResponse.json({
    total,
    returned: rows.length,
    summary: {
      classification: fold(byClass, "classification"),
      reviewStatus: fold(byReview, "reviewStatus"),
    },
    candidates: rows.map((r) => serialize(r as Record<string, unknown>)),
  });
}

export async function PATCH(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    reviewStatus?: string;
    notes?: string;
  } | null;

  if (!body?.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  if (
    !body.reviewStatus ||
    !(REVIEW_STATUSES as readonly string[]).includes(body.reviewStatus)
  ) {
    return NextResponse.json(
      { error: `reviewStatus must be one of ${REVIEW_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.shillCorrelationCandidate.update({
      where: { id: body.id },
      data: {
        reviewStatus: body.reviewStatus,
        ...(typeof body.notes === "string" ? { notes: body.notes } : {}),
      },
    });
    return NextResponse.json({
      ok: true,
      candidate: serialize(updated as Record<string, unknown>),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `update failed: ${(e as Error).message}` },
      { status: 404 },
    );
  }
}
