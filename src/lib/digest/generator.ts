// src/lib/digest/generator.ts

export interface DigestKol {
  handle: string;
  tier: string;
  rugCount: number;
}

export interface DigestCasefile {
  slug: string;
  title: string;
  score: number;
}

export interface DigestData {
  week_start: Date;
  new_kols_flagged: DigestKol[];
  new_casefiles: DigestCasefile[];
  total_proceeds_usd: number;
  top_stat: string;
}

export async function generateDigest(): Promise<DigestData> {
  const weekStart = new Date(Date.now() - 7 * 86_400_000);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    // New KOL profiles flagged this week
    const kols = await prisma.kolProfile.findMany({
      where: {
        createdAt: { gte: weekStart },
        riskFlag: { not: "unverified" },
      },
      select: { handle: true, tier: true, rugCount: true, riskFlag: true },
      orderBy: { rugCount: "desc" },
      take: 10,
    });

    // New casefiles published this week
    const casefiles = await prisma.caseFile.findMany({
      where: {
        createdAt: { gte: weekStart },
        status: { in: ["published", "pending"] },
      },
      select: { signalId: true },
      take: 10,
    });

    // Total proceeds from KolTokenInvolvement this week
    const proceeds = await prisma.kolTokenInvolvement.aggregate({
      where: { createdAt: { gte: weekStart } },
      _sum: { proceedsUsd: true },
    });

    const totalProceeds = Number(proceeds._sum?.proceedsUsd ?? 0);
    const redKols = kols.filter((k) => k.tier === "RED" || k.riskFlag === "high").length;

    const topStat =
      redKols > 0
        ? `${redKols} new RED KOL profile${redKols > 1 ? "s" : ""} this week`
        : kols.length > 0
          ? `${kols.length} new KOL profile${kols.length > 1 ? "s" : ""} flagged this week`
          : "No new threats flagged this week";

    return {
      week_start: weekStart,
      new_kols_flagged: kols.map((k) => ({
        handle: k.handle,
        tier: k.tier ?? "UNKNOWN",
        rugCount: k.rugCount ?? 0,
      })),
      new_casefiles: casefiles.map((c) => ({
        slug: c.signalId,
        title: c.signalId,
        score: 0,
      })),
      total_proceeds_usd: totalProceeds,
      top_stat: topStat,
    };
  } finally {
    await prisma.$disconnect();
  }
}
