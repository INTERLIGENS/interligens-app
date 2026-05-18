import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { searchParams } = req.nextUrl;
  const handle = searchParams.get("handle") ?? undefined;
  const severity = searchParams.get("severity") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  type ContradictionRow = {
    id: string;
    kolHandle: string;
    tokenMint: string;
    tokenSymbol: string | null;
    tweetAt: Date;
    tweetText: string | null;
    tweetUrl: string | null;
    sellAt: Date;
    sellAmountUsd: number | null;
    delayMinutes: number;
    severity: string;
    confidenceScore: number;
    status: string;
    createdAt: Date;
  };

  try {
    // Build filter clauses dynamically (raw SQL, table not yet in Prisma schema)
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (handle) {
      conditions.push(`"kolHandle" = $${idx++}`);
      params.push(handle);
    }
    if (severity) {
      conditions.push(`"severity" = $${idx++}`);
      params.push(severity);
    }
    if (status) {
      conditions.push(`"status" = $${idx++}`);
      params.push(status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = await prisma.$queryRawUnsafe<ContradictionRow[]>(
      `SELECT id, "kolHandle", "tokenMint", "tokenSymbol",
              "tweetAt", "tweetText", "tweetUrl",
              "sellAt", "sellAmountUsd", "delayMinutes",
              "severity", "confidenceScore", "status", "createdAt"
       FROM "ContradictionAlert"
       ${where}
       ORDER BY
         CASE "severity" WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 ELSE 3 END,
         "createdAt" DESC
       LIMIT 500`,
      ...params,
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[contradictions] GET failed", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  try {
    const body = await req.json() as { id: string; status: "reviewed" | "dismissed" };
    const { id, status } = body;
    if (!id || !["reviewed", "dismissed"].includes(status)) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }

    await prisma.$executeRaw`
      UPDATE "ContradictionAlert"
      SET "status" = ${status}
      WHERE "id" = ${id}
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contradictions] PATCH failed", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
