import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [signalCount, kolCount, campaignCount, highPriorityCount, lastDigest] =
    await Promise.all([
      prisma.socialPostCandidate.count({
        where: { discoveredAtUtc: { gte: todayStart } },
      }),
      prisma.socialPostCandidate.groupBy({
        by: ["influencerId"],
        where: { discoveredAtUtc: { gte: todayStart } },
        _count: true,
      }).then((rows) => rows.length),
      prisma.watcherCampaign.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.watcherCampaign.count({
        where: {
          createdAt: { gte: todayStart },
          priority: { in: ["HIGH", "CRITICAL"] },
        },
      }),
      prisma.watcherDigest.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, emailStatus: true, signalCount: true },
      }),
    ]);

  return NextResponse.json({
    kolCount,
    signalCount,
    campaignCount,
    highPriorityCount,
    lastScanAt: lastDigest?.createdAt ?? null,
    lastDigestStatus: lastDigest?.emailStatus ?? null,
  });
}
