import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft:    ["reviewed"],
  reviewed: ["published", "draft"],
  published:["draft"],
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  const authHeader = req.headers.get("authorization") ?? "";
  const expectedUser = process.env.ADMIN_BASIC_USER ?? "";
  const expectedPass = process.env.ADMIN_BASIC_PASS ?? "";
  const expected = "Basic " + Buffer.from(`${expectedUser}:${expectedPass}`).toString("base64");
  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { status, reviewNote } = body;

  if (!["draft", "reviewed", "published"].includes(status)) {
    return NextResponse.json({ error: "Invalid status. Must be draft | reviewed | published" }, { status: 400 });
  }

  const existing = await prisma.$queryRaw`
    SELECT "reviewStatus" FROM "KolProceedsSummary" WHERE "kolHandle" = ${handle} LIMIT 1
  ` as any[];

  if (!existing.length) {
    return NextResponse.json({ error: "No proceeds summary found for this handle" }, { status: 404 });
  }

  const current = existing[0].reviewStatus;
  const allowed = VALID_TRANSITIONS[current] ?? [];

  if (!allowed.includes(status)) {
    return NextResponse.json({
      error: `Invalid transition: ${current} → ${status}. Allowed: ${allowed.join(", ") || "none"}`,
    }, { status: 400 });
  }

  await prisma.$executeRawUnsafe(`
    UPDATE "KolProceedsSummary"
    SET "reviewStatus" = $1, "reviewNote" = $2, "updatedAt" = now()
    WHERE "kolHandle" = $3
  `, status, reviewNote ?? null, handle);

  return NextResponse.json({
    success: true,
    handle,
    previousStatus: current,
    newStatus: status,
    reviewNote: reviewNote ?? null,
    updatedAt: new Date().toISOString(),
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  const authHeader = req.headers.get("authorization") ?? "";
  const expectedUser = process.env.ADMIN_BASIC_USER ?? "";
  const expectedPass = process.env.ADMIN_BASIC_PASS ?? "";
  const expected = "Basic " + Buffer.from(`${expectedUser}:${expectedPass}`).toString("base64");
  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.$queryRaw`
    SELECT
      "kolHandle", "reviewStatus", "reviewNote", "computedAt", "updatedAt",
      "totalProceedsUsd", "eventCount", "walletCount", "confidence",
      "methodologyVersion", "coverageStatus", "coverageNote"
    FROM "KolProceedsSummary"
    WHERE "kolHandle" = ${handle}
    LIMIT 1
  ` as any[];

  if (!rows.length) {
    return NextResponse.json({ found: false, handle });
  }

  const s = rows[0];
  const staleDays = s.computedAt
    ? Math.floor((Date.now() - new Date(s.computedAt).getTime()) / 86400000)
    : null;

  return NextResponse.json({
    found: true,
    handle,
    reviewStatus: s.reviewStatus,
    reviewNote: s.reviewNote,
    computedAt: s.computedAt,
    updatedAt: s.updatedAt,
    staleDays,
    stale: staleDays !== null && staleDays > 7,
    totalProceedsUsd: s.totalProceedsUsd,
    eventCount: Number(s.eventCount),
    walletCount: Number(s.walletCount),
    confidence: s.confidence,
    methodologyVersion: s.methodologyVersion,
    coverageStatus: s.coverageStatus,
    coverageNote: s.coverageNote,
    allowedTransitions: VALID_TRANSITIONS[s.reviewStatus] ?? [],
  });
}
