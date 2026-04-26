import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { searchParams } = req.nextUrl;
  const chain = searchParams.get("chain") ?? undefined;
  const patternType = searchParams.get("patternType") ?? undefined;

  type SerialPatternRow = {
    id: string;
    deployerAddress: string;
    chain: string;
    tokenCount: number;
    rugCount: number;
    patternType: string;
    confidence: number;
    firstSeenAt: Date;
    lastSeenAt: Date;
    linkedKolHandles: unknown;
    linkedCaseIds: unknown;
    createdAt: Date;
  };

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (chain) {
      conditions.push(`chain = $${idx++}`);
      params.push(chain);
    }
    if (patternType) {
      conditions.push(`"patternType" = $${idx++}`);
      params.push(patternType);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = await prisma.$queryRawUnsafe<SerialPatternRow[]>(
      `SELECT id, "deployerAddress", chain, "tokenCount", "rugCount",
              "patternType", "confidence", "firstSeenAt", "lastSeenAt",
              "linkedKolHandles", "linkedCaseIds", "createdAt"
       FROM "SerialPattern"
       ${where}
       ORDER BY "confidence" DESC, "tokenCount" DESC
       LIMIT 200`,
      ...params,
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[serial-patterns] GET failed", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
