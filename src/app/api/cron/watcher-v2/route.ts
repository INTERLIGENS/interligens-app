/**
 * src/app/api/cron/watcher-v2/route.ts
 * WatcherV2 — X API Native KOL scan (daily cron)
 *
 * Email mode: controlled by WATCHER_EMAIL_MODE env var
 *   "off"       — no emails sent
 *   "immediate" — one email per handle (legacy behaviour)
 *   "digest"    — one batch digest email after the full scan (default)
 */
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserByUsername, getUserTweetsWindow, hasToken, isSpendCapped, spendCapResetDate } from "@/lib/xapi/client";
import { detectSignals, shouldKeep } from "@/lib/watcher/tokenDetector";
import { handlesV2 } from "@/lib/watcher/handles";
import { sendKolAlert } from "@/lib/alerts/kolAlert";
import { sendWatcherDigest, type BatchSignal, type CampaignSummary } from "@/lib/alerts/watcherDigest";
import { clusterSignals, type SignalInput } from "@/lib/watcher/campaignClusterer";

// Vercel cron route config — force dynamic execution and extend the default
// 10s serverless timeout to accommodate the per-handle sleep(1000) loop.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

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

// ─── Real X API cost tracking → XApiUsage (raw SQL) ───────────
//
// Prix calé sur la facture réelle X (pay-per-use, 2026-05-21→06-20):
// $79.97 / 13 810 posts = ~$0.0058/post. Configurable via
// X_API_COST_PER_POST (défaut 0.0058). User lookups non refacturés
// par défaut (la facture impute tout aux posts) ; X_API_COST_PER_LOOKUP
// existe si on veut les modéliser. Écrit le schéma réel de la table
// live (monthStart/totalCostUsd/tweetsFetched/userLookups) en SQL
// brut — le modèle Prisma (month/estimatedUsd) est périmé.
//
// Upsert atomique ON CONFLICT sur l'index unique
// XApiUsage_monthStart_key (posé en prod via Neon). Appelé une fois
// par run dans un finally → comptabilise les reads réellement faits
// même si le scan s'interrompt, sans double comptage (1 écriture/run).
// Toute erreur d'écriture est avalée : le tracking ne casse jamais le scan.
async function recordXApiUsage(stats: { tweetsFetched: number; userLookups: number }) {
  const costPerPost = parseFloat(process.env.X_API_COST_PER_POST ?? "0.0058");
  const costPerLookup = parseFloat(process.env.X_API_COST_PER_LOOKUP ?? "0");
  const posts = stats.tweetsFetched;
  const lookups = stats.userLookups;
  if (posts === 0 && lookups === 0) {
    console.log("[watcher-v2] XApiUsage: 0 read consommé — aucune écriture");
    return;
  }
  const runCost = posts * costPerPost + lookups * costPerLookup;
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "XApiUsage"
         ("id", "monthStart", "totalCostUsd", "tweetsFetched", "userLookups", "updatedAt")
       VALUES (gen_random_uuid()::text,
               date_trunc('month', (now() at time zone 'utc')),
               $1, $2, $3, now())
       ON CONFLICT ("monthStart") DO UPDATE SET
         "totalCostUsd"  = "XApiUsage"."totalCostUsd"  + EXCLUDED."totalCostUsd",
         "tweetsFetched" = "XApiUsage"."tweetsFetched" + EXCLUDED."tweetsFetched",
         "userLookups"   = "XApiUsage"."userLookups"   + EXCLUDED."userLookups",
         "updatedAt"     = now()`,
      runCost, posts, lookups,
    );
    console.log(
      `[watcher-v2] 💰 XApiUsage upsert: +$${runCost.toFixed(4)} (+${posts} posts, +${lookups} lookups)`,
    );
  } catch (err) {
    console.error("[watcher-v2] XApiUsage write failed (scan unaffected):", err);
  }
}

async function scanAll() {
  const emailMode = (process.env.WATCHER_EMAIL_MODE ?? "digest").toLowerCase();
  const scanStart = new Date();

  const stats = {
    scanned: 0,
    failed: 0,
    tweetsFetched: 0,
    userLookups: 0,
    candidates: 0,
    skipped: 0,
    enriched: 0,
    promoted: 0,
  };

  // Accumulates per-handle signal summaries for the batch digest.
  const batchSignals: BatchSignal[] = [];
  // Accumulates full signal data for campaign clustering.
  const newSignals: SignalInput[] = [];

  // Budget guard: cap the number of handles scanned per run.
  // Default 50 keeps monthly X API usage well under the $50 ceiling.
  const maxHandles = parseInt(process.env.WATCHER_MAX_HANDLES ?? "50", 10);
  const watchlist = handlesV2.slice(0, maxHandles);
  console.log(`[watcher-v2] Budget mode: scanning ${watchlist.length} of ${handlesV2.length} handles (WATCHER_MAX_HANDLES=${maxHandles})`);

  // ── Resume window (catch-up) ────────────────────────────────────────────
  // The cron is daily → look back a bit MORE than 24h so a late/early run
  // never leaves a gap. Overlap is harmless: the (postId,influencerId) unique
  // key dedups re-seen posts. Per-handle cap bounds the cost of a hyper-active
  // account (pagination would otherwise pull every post in the window).
  const lookbackHours = parseInt(process.env.WATCHER_LOOKBACK_HOURS ?? "26", 10);
  const maxPostsPerHandle = parseInt(process.env.WATCHER_MAX_POSTS_PER_HANDLE ?? "15", 10);
  const startTime = new Date(scanStart.getTime() - lookbackHours * 3_600_000).toISOString();
  console.log(`[watcher-v2] Resume window: start_time=${startTime} (lookback ${lookbackHours}h), cap=${maxPostsPerHandle} posts/handle (GordonGekko 100)`);

  // Spend-cap short-circuit. The X API billing spend cap makes EVERY read 403
  // (masquerading as "not found"), which would otherwise march the whole
  // watchlist logging dozens of false "SKIP — not found" lines and burn the
  // serverless budget. Probe ONE handle up front; if the latch trips, bail
  // cleanly before the loop so a capped run is unambiguous and cheap.
  if (watchlist.length > 0) {
    await getUserByUsername(watchlist[0].handle);
    if (isSpendCapped()) {
      const resetDate = spendCapResetDate() ?? null;
      console.error(
        `[watcher-v2] 🛑 X API spend cap reached — aborting scan before processing any handle. ` +
          `Reads resume ${resetDate ?? "next billing cycle"}. Raise the cap in the X developer console to resume now.`,
      );
      return {
        ok: true,
        spendCapped: true,
        resetDate,
        ...stats,
        note: `X API spend cap reached — scan aborted, 0 handles processed. Resets ${resetDate ?? "next billing cycle"}.`,
      };
    }
    stats.userLookups++; // not capped: the probe lookup is a real billed read
  }

  // try/finally : on enregistre la conso X API réelle exactement une
  // fois (les reads déjà faits sont facturés même si le scan s'arrête).
  try {
  for (const entry of watchlist) {
    const handle = entry.handle;

    try {
      const xUser = await getUserByUsername(handle);
      stats.userLookups++; // 1 requête X API facturée, succès ou non
      if (!xUser) {
        console.warn(`[watcher-v2] SKIP @${handle} — not found`);
        stats.failed++;
        await sleep(1_000);
        continue;
      }
      stats.scanned++;

      const profileSnapshot = JSON.stringify({
        followers: xUser.public_metrics?.followers_count ?? 0,
        bio: xUser.description?.slice(0, 200) ?? "",
        fetchedAt: new Date().toISOString(),
      });

      // Windowed catch-up: page through [startTime, now], capped per handle.
      // GordonGekko keeps a higher cap (high-volume case under investigation).
      const handleCap = handle === "GordonGekko" ? 100 : maxPostsPerHandle;
      const tweets = await getUserTweetsWindow(xUser.id, { startTime, maxPosts: handleCap });
      stats.tweetsFetched += tweets.length;

      const influencerId = await ensureInfluencer(handle);

      // Per-handle tracking for alert fan-out after the inner loop.
      let handleNewCandidates = 0;
      const handleSignalSamples: string[] = [];

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

        const candidate = await prisma.socialPostCandidate.create({
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
            rawText: tweet.text,
            dedupKey,
            profileSnapshot,
          },
        });
        // Accumulate for campaign clustering
        newSignals.push({
          id: candidate.id,
          kolHandle: handle,
          detectedTokens: candidate.detectedTokens,
          detectedAddresses: candidate.detectedAddresses,
          rawText: tweet.text,
          discoveredAtUtc: candidate.discoveredAtUtc,
          signalScore: candidate.signalScore,
        });
        stats.candidates++;
        handleNewCandidates++;
        if (handleSignalSamples.length < 3) {
          const tokens = detection.detectedTokens?.slice(0, 2).join(", ");
          const snippet = tweet.text.slice(0, 140);
          handleSignalSamples.push(
            tokens ? `${tokens} — ${snippet}` : snippet
          );
        }
      }

      if (handleNewCandidates > 0) {
        const tokens = handleSignalSamples
          .flatMap((s) => {
            const m = s.match(/^\$[A-Z]+/);
            return m ? [m[0]] : [];
          })
          .filter((v, i, a) => a.indexOf(v) === i);

        const snippet =
          handleSignalSamples.join(" · ") || `${handleNewCandidates} new signals`;

        if (emailMode === "immediate") {
          // Legacy: one email per handle
          sendKolAlert(handle, handleNewCandidates, snippet).catch((err) =>
            console.error("[watcher-v2] kol alert crashed", err)
          );
        } else if (emailMode === "digest") {
          // Accumulate for batch digest sent after the full loop
          batchSignals.push({ handle, signalCount: handleNewCandidates, tokens, snippet });
        }
        // emailMode === "off" → do nothing
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
    } catch (err) {
      console.error(`[watcher-v2] SKIP @${handle} — error during scan:`, err);
      stats.failed++;
      await sleep(1_000);
      continue;
    }
  }
  } finally {
    // Conso X API réelle de ce run → XApiUsage (cumul mois courant)
    await recordXApiUsage(stats);
  }

  // ── Campaign clustering + digest (after full scan) ──────────────────────
  let clusterResult = { campaignsCreated: 0, signalsLinked: 0, highPriority: 0, critical: 0 };
  let campaignSummaries: CampaignSummary[] = [];

  if (newSignals.length > 0) {
    try {
      clusterResult = await clusterSignals(newSignals);

      // Fetch created campaigns for digest summary
      const campaigns = await prisma.watcherCampaign.findMany({
        where: { createdAt: { gte: scanStart } },
        include: { campaignKols: { select: { kolHandle: true } } },
        orderBy: [{ priority: "asc" }, { signalCount: "desc" }],
        take: 20,
      });
      campaignSummaries = campaigns.map((c) => ({
        id: c.id,
        primaryTokenSymbol: c.primaryTokenSymbol,
        primaryContractAddress: c.primaryContractAddress,
        priority: c.priority,
        kolHandles: c.campaignKols.map((k) => k.kolHandle),
        signalCount: c.signalCount,
        claimPatterns: (() => { try { return JSON.parse(c.claimPatterns); } catch { return []; } })(),
      }));
    } catch (err) {
      console.error("[watcher-v2] clustering failed", err);
    }
  }

  // Send one digest email after the full scan
  if (emailMode === "digest" && batchSignals.length > 0) {
    sendWatcherDigest(batchSignals, campaignSummaries, scanStart, new Date()).catch((err) =>
      console.error("[watcher-v2] digest send crashed", err)
    );
  }

  return {
    ok: true,
    ...stats,
    emailMode,
    digestBatched: batchSignals.length,
    campaignsCreated: clusterResult.campaignsCreated,
    highPriority: clusterResult.highPriority,
    critical: clusterResult.critical,
    quotaEstimate: `~${(stats.tweetsFetched * 30).toLocaleString()} tweets/month`,
    xApiCostUsd: Number(
      (stats.tweetsFetched * parseFloat(process.env.X_API_COST_PER_POST ?? "0.0058")
        + stats.userLookups * parseFloat(process.env.X_API_COST_PER_LOOKUP ?? "0")).toFixed(4),
    ),
  };
}

export async function GET(req: NextRequest) {
  // Fail-closed auth: reject if CRON_SECRET is not configured at all,
  // otherwise the string "Bearer undefined" could be used to bypass the check.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server misconfigured: CRON_SECRET not set" },
      { status: 500 }
    );
  }
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${secret}`) {
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
