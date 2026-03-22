/**
 * src/lib/surveillance/social/jobs.ts
 * Jobs : discover posts + capture evidence
 */

import { prisma } from "@/lib/prisma";
import { XAuthProvider } from "./providers/xAuthProvider";
import { NitterRssProvider } from "./providers/nitterRss";
import { PlaywrightProfileProvider } from "./providers/playwrightProfile";
import { captureSocialPost } from "../evidencePack";
import { randomUUID } from "crypto";

const DISCOVER_BATCH = parseInt(process.env.SOCIAL_DISCOVER_BATCH ?? "20");
const CAPTURE_BATCH = parseInt(process.env.SOCIAL_CAPTURE_BATCH ?? "10");
const MAX_ATTEMPTS = 3;

// ─── DISCOVER ────────────────────────────────────────────────────────────────

export async function discoverPosts(): Promise<{
  handled: number;
  newCandidates: number;
  errors: number;
}> {
  const watchlist = await prisma.socialWatchlist.findMany({
    where: { status: "active" },
    take: DISCOVER_BATCH,
    orderBy: { lastCheckedAt: "asc" },
  });

  let newCandidates = 0;
  let errors = 0;

  for (const entry of watchlist) {
    try {
      const posts = await fetchWithFallback(entry.handle, entry.lastSeenPostId ?? undefined);

      for (const post of posts) {
        await prisma.socialPostCandidate.upsert({
          where: {
            postId_influencerId: {
              postId: post.postId,
              influencerId: entry.influencerId,
            },
          },
          create: {
            id: randomUUID(),
            influencerId: entry.influencerId,
            postUrl: post.postUrl,
            postId: post.postId,
            postedAtUtc: post.postedAtUtc ?? null,
            sourceProvider: entry.provider,
            status: "new",
          },
          update: {},
        });
        newCandidates++;
      }

      // Update lastSeenPostId avec le plus récent
      if (posts.length > 0) {
        await prisma.socialWatchlist.update({
          where: { id: entry.id },
          data: {
            lastCheckedAt: new Date(),
            lastSeenPostId: posts[0].postId,
            errorMessage: null,
          },
        });
      } else {
        await prisma.socialWatchlist.update({
          where: { id: entry.id },
          data: { lastCheckedAt: new Date() },
        });
      }
    } catch (err: any) {
      errors++;
      await prisma.socialWatchlist.update({
        where: { id: entry.id },
        data: {
          lastCheckedAt: new Date(),
          errorMessage: err.message,
          status: err.message?.includes("PROVIDER_UNAVAILABLE") ? "error" : "active",
        },
      });
    }
  }

  return { handled: watchlist.length, newCandidates, errors };
}

// ─── CAPTURE ─────────────────────────────────────────────────────────────────

export async function captureCandidates(): Promise<{
  processed: number;
  captured: number;
  blocked: number;
  failed: number;
}> {
  const candidates = await prisma.socialPostCandidate.findMany({
    where: {
      status: { in: ["new", "failed"] },
      attempts: { lt: MAX_ATTEMPTS },
    },
    take: CAPTURE_BATCH,
    orderBy: { discoveredAtUtc: "asc" },
    include: { influencer: true },
  });

  let captured = 0;
  let blocked = 0;
  let failed = 0;

  for (const c of candidates) {
    await prisma.socialPostCandidate.update({
      where: { id: c.id },
      data: { status: "queued", lastAttemptAtUtc: new Date() },
    });

    try {
      const result = await captureSocialPost(
        c.postUrl,
        c.influencer.handle,
        c.influencerId
      );

      if (result.status === "COMPLETED") {
        await prisma.socialPostCandidate.update({
          where: { id: c.id },
          data: {
            status: "captured",
            linkedSocialPostId: result.socialPostId,
            attempts: { increment: 1 },
            errorMessage: null,
          },
        });
        captured++;
      } else if (result.status === "BLOCKED") {
        await prisma.socialPostCandidate.update({
          where: { id: c.id },
          data: {
            status: "blocked",
            attempts: { increment: 1 },
            errorMessage: result.error ?? "CAPTURE_BLOCKED",
          },
        });
        blocked++;
      } else {
        await prisma.socialPostCandidate.update({
          where: { id: c.id },
          data: {
            status: "failed",
            attempts: { increment: 1 },
            errorMessage: result.error ?? "UNKNOWN",
          },
        });
        failed++;
      }
    } catch (err: any) {
      await prisma.socialPostCandidate.update({
        where: { id: c.id },
        data: {
          status: "failed",
          attempts: { increment: 1 },
          errorMessage: err.message,
        },
      });
      failed++;
    }
  }

  return { processed: candidates.length, captured, blocked, failed };
}

// ─── PROVIDER WITH FALLBACK ──────────────────────────────────────────────────

async function fetchWithFallback(handle: string, sincePostId?: string) {
  // 1. XAuth
  try {
    return await new XAuthProvider().fetchLatest(handle, sincePostId);
  } catch (e: any) {
    if (e.message?.includes("RATE_LIMITED") || e.message?.includes("PROVIDER_UNAVAILABLE")) {
      // fallback
    } else throw e;
  }
  // 2. Nitter
  if (process.env.NITTER_BASE_URL) {
    try { return await new NitterRssProvider().fetchLatest(handle, sincePostId); } catch {}
  }
  // 3. Playwright
  if (process.env.SOCIAL_PROVIDER_FALLBACK_ENABLED === "true") {
    return await new PlaywrightProfileProvider().fetchLatest(handle, sincePostId);
  }
  throw new Error("PROVIDER_UNAVAILABLE: all providers failed");
}
