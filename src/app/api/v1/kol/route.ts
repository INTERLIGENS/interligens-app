import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PUBLIC_KOL_FILTER } from "@/lib/kol/publishGate";

export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tier = searchParams.get("tier");
  const platform = searchParams.get("platform");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const where = {
    ...PUBLIC_KOL_FILTER,
    ...(tier ? { tier } : {}),
    ...(platform ? { platform } : {}),
  };

  const [profiles, total, proceedsList] = await Promise.all([
    prisma.kolProfile.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { rugCount: "desc" },
      select: {
        handle: true,
        displayName: true,
        label: true,
        platform: true,
        followerCount: true,
        tier: true,
        riskFlag: true,
        confidence: true,
        verified: true,
        rugCount: true,
        totalScammed: true,
        summary: true,
        evidenceDepth: true,
        completenessLevel: true,
        profileStrength: true,
        behaviorFlags: true,
        _count: { select: { evidences: true, kolCases: true } },
      },
    }),
    prisma.kolProfile.count({ where }),
    prisma.$queryRaw`SELECT "kolHandle", "totalProceedsUsd", confidence as "proceedsConfidence" FROM "KolProceedsSummary"` as Promise<any[]>,
  ]);

  const proceedsMap = new Map(proceedsList.map((r: any) => [r.kolHandle, r]));

  return NextResponse.json({
    version: "1.0",
    total,
    limit,
    offset,
    results: profiles.map((p) => {
      const proceeds = proceedsMap.get(p.handle);
      return {
        handle: p.handle,
        displayName: p.displayName,
        label: p.label,
        platform: p.platform,
        followerCount: p.followerCount,
        tier: p.tier,
        riskFlag: p.riskFlag,
        confidence: p.confidence,
        verified: p.verified,
        rugCount: p.rugCount,
        totalScammed: p.totalScammed,
        evidenceCount: p._count.evidences,
        caseCount: p._count.kolCases,
        summary: p.summary,
        evidenceDepth: p.evidenceDepth,
        completenessLevel: p.completenessLevel,
        profileStrength: p.profileStrength,
        behaviorFlags: p.behaviorFlags,
        totalProceedsUsd: proceeds?.totalProceedsUsd ?? null,
        proceedsConfidence: proceeds?.proceedsConfidence ?? null,
        profileUrl: `https://interligens.com/en/kol/${p.handle}`,
      };
    }),
  });
}
