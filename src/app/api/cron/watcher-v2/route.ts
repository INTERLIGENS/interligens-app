/**
 * src/app/api/cron/watcher-v2/route.ts
 * WatcherV2 — X API Native KOL scan (daily cron)
 */
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserByUsername, getUserTweets, hasToken } from "@/lib/xapi/client";
import { detectSignals, shouldKeep } from "@/lib/watcher/tokenDetector";
import { handlesV2 } from "../../../../../scripts/watcher/handles-v2";

const prisma = new PrismaClient();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureInfluencer(handle: string): Promise<string> {
  const existing = await prisma.influencer.findUnique({ where: { handle } });
  if (existing) return existing.id;
  const created = await prisma.influencer.create({ data: { handle, platform: "x" } });
  return created.id;
}

async function scanAll() {
  const stats = {
    scanned: 0,
    failed: 0,
    tweetsFetched: 0,
    candidates: 0,
    skipped: 0,
    enriched: 0,
    promoted: 0,
  };

  for (const entry of handlesV2) {
    const handle = entry.handle;

    const xUser = await getUserByUsername(handle);
    if (!xUser) { stats.failed++; await sleep(1_000); continue; }
    stats.scanned++;

    const profileSnapshot = JSON.stringify({
      followers: xUser.public_metrics?.followers_count ?? 0,
      bio: xUser.description?.slice(0, 200) ?? "",
      fetchedAt: new Date().toISOString(),
    });

    const tweets = await getUserTweets(xUser.id, 10);
    stats.tweetsFetched += tweets.length;

    const influencerId = await ensureInfluencer(handle);

    for (const tweet of tweets) {
      const detection = detectSignals(tweet.text);
      if (!shouldKeep(detection, 20)) continue;

      // Dedup via the real composite unique key (postId, influencerId).
      // Legacy rows have dedupKey=NULL so a dedupKey-only lookup misses them
      // and the subsequent create() would collide on (postId, influencerId).
      // Select only `id` to bypass any field-level decode quirks on legacy
      // rows (e.g. `detectedTokens` jsonb→String coercion in pooled prod).
      const dedupKey = `${tweet.id}:${handle}`;
      const existing = await prisma.socialPostCandidate.findUnique({
        where: { postId_influencerId: { postId: tweet.id, influencerId } },
        select: { id: true },
      });
      if (existing) { stats.skipped++; continue; }

      await prisma.socialPostCandidate.create({
        data: {
          influencerId,
          postId: tweet.id,
          postUrl: `https://x.com/${handle}/status/${tweet.id}`,
          sourceProvider: "x_api_v2",
          status: "new",
          postedAtUtc: tweet.created_at ? new Date(tweet.created_at) : null,
          detectedTokens: JSON.stringify(detection.detectedTokens),
          detectedAddresses: JSON.stringify(detection.detectedAddresses),
          signalTypes: JSON.stringify(detection.signalTypes),
          signalScore: detection.signalScore,
          dedupKey,
          profileSnapshot,
        },
      });
      stats.candidates++;
    }

    // Enrich existing KolProfile
    const kolProfile = await prisma.kolProfile.findUnique({ where: { handle } });
    if (kolProfile) {
      const updates: Record<string, unknown> = { lastEnrichedAt: new Date() };
      if (!kolProfile.followerCount && xUser.public_metrics?.followers_count)
        updates.followerCount = xUser.public_metrics.followers_count;
      if (!kolProfile.bio && xUser.description) updates.bio = xUser.description;
      if (!kolProfile.displayName && xUser.name) updates.displayName = xUser.name;
      await prisma.kolProfile.update({ where: { handle }, data: updates });
      stats.enriched++;
    }

    await sleep(1_000);
  }

  return {
    ok: true,
    ...stats,
    quotaEstimate: `~${(stats.tweetsFetched * 30).toLocaleString()} tweets/month`,
  };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasToken()) {
    return NextResponse.json({ error: "X_BEARER_TOKEN not configured" }, { status: 500 });
  }

  try {
    const result = await scanAll();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[watcher-v2] cron error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
