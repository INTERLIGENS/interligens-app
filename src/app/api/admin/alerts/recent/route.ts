import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";

/**
 * Recent watcher alerts — the 20 most recent SocialPostCandidate rows
 * created by the WatcherV2 cron, ordered by creation time desc.
 *
 * NOTE: The task spec referenced "WatchScan with status=ALERT" but the
 * current schema does not have that field. The watcher creates
 * SocialPostCandidate rows instead — those are the alerts in practice.
 * Each candidate joins to its influencer for the handle.
 */
export async function GET(req: NextRequest) {
  const unauthorized = requireAdminApi(req);
  if (unauthorized) return unauthorized;

  try {
    const rows = await prisma.socialPostCandidate.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        postId: true,
        postUrl: true,
        status: true,
        signalScore: true,
        signalTypes: true,
        detectedTokens: true,
        postedAtUtc: true,
        createdAt: true,
        influencer: { select: { handle: true, platform: true } },
      },
    });

    return NextResponse.json({
      alerts: rows.map((r) => ({
        id: r.id,
        handle: r.influencer?.handle ?? null,
        platform: r.influencer?.platform ?? null,
        postId: r.postId,
        postUrl: r.postUrl,
        status: r.status,
        signalScore: r.signalScore,
        signalTypes: r.signalTypes,
        detectedTokens: r.detectedTokens,
        postedAtUtc: r.postedAtUtc,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error("[admin/alerts/recent] failed", err);
    return NextResponse.json({ alerts: [] });
  }
}
