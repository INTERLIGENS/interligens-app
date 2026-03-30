import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  try {
    const summary = await prisma.$queryRaw`
      SELECT
        "kolHandle", "totalProceedsUsd", "proceedsByYear",
        "topWalletLabel", "topWalletProceedsUsd",
        "topTokenSymbol", "topTokenProceedsUsd",
        "largestEventUsd", "largestEventDate",
        "walletCount", "caseCount", "eventCount",
        confidence, "methodologyVersion", "computedAt",
        "coverageStatus", "coverageNote"
      FROM "KolProceedsSummary"
      WHERE "kolHandle" = ${handle}
      AND "reviewStatus" = 'published'
      LIMIT 1
    ` as any[];

    if (!summary.length) {
      return NextResponse.json({ found: false, handle, reason: "No published proceeds summary available" });
    }

    const s = summary[0];
    return NextResponse.json({
      found: true,
      handle,
      totalProceedsUsd: s.totalProceedsUsd,
      proceedsByYear: typeof s.proceedsByYear === 'string' ? JSON.parse(s.proceedsByYear) : s.proceedsByYear,
      topWalletLabel: s.topWalletLabel ?? null,
      topWalletProceedsUsd: s.topWalletProceedsUsd ?? null,
      topTokenSymbol: s.topTokenSymbol ?? null,
      topTokenProceedsUsd: s.topTokenProceedsUsd ?? null,
      largestEventUsd: s.largestEventUsd ?? null,
      largestEventDate: s.largestEventDate ?? null,
      walletCount: Number(s.walletCount),
      caseCount: Number(s.caseCount),
      eventCount: Number(s.eventCount),
      confidence: s.confidence,
      methodologyVersion: s.methodologyVersion,
      computedAt: s.computedAt,
      coverageStatus: s.coverageStatus,
      coverageNote: s.coverageNote ?? null,
    });
  } catch (err: any) {
    console.error("[proceeds/public]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
