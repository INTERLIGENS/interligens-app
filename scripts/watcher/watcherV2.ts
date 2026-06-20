import fs from 'fs';
const envLocal = fs.readFileSync('.env.local', 'utf8');
const dbUrl = envLocal.match(/DATABASE_URL="([^"]+)"/)?.[1];
if (dbUrl) process.env.DATABASE_URL = dbUrl;
// Also load X bearer token from .env.local
const xToken = envLocal.match(/X_BEARER_TOKEN="?([^"\n]+)"?/)?.[1]
  ?? envLocal.match(/TWITTER_BEARER_TOKEN="?([^"\n]+)"?/)?.[1];
if (xToken) process.env.X_BEARER_TOKEN = xToken;

// ─────────────────────────────────────────────────────────────
// WATCHER V2 — X API Native + Candidate-First KOL Discovery
// INTERLIGENS · Ingestion → Detection → Candidate → Promotion
// ─────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { getUserByUsername, getUserTweets, hasToken } from '../../src/lib/xapi/client';
import { detectSignals, shouldKeep } from '../../src/lib/watcher/tokenDetector';
import { handlesV2, type WatchHandle } from './handles-v2';
import { runSeedBatch } from '../seed/engine';
import type { SeedKolProfile } from '../seed/types';
import type { XUser, XTweet } from '../../src/lib/xapi/client';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === 'true';

// ─── Stats ────────────────────────────────────────────────────

interface WatcherStats {
  handlesScanned: number;
  handlesFailed: number;
  tweetsFetched: number;
  userLookups: number;
  candidatesCreated: number;
  candidatesSkipped: number;
  profilesEnriched: number;
  profilesPromoted: number;
}

function emptyStats(): WatcherStats {
  return {
    handlesScanned: 0,
    handlesFailed: 0,
    tweetsFetched: 0,
    userLookups: 0,
    candidatesCreated: 0,
    candidatesSkipped: 0,
    profilesEnriched: 0,
    profilesPromoted: 0,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Ensure Influencer record exists ──────────────────────────

async function ensureInfluencer(handle: string): Promise<string> {
  const existing = await prisma.influencer.findUnique({ where: { handle } });
  if (existing) return existing.id;

  const created = await prisma.influencer.create({
    data: { handle, platform: 'x' },
  });
  console.log(`    + influencer record created: ${handle}`);
  return created.id;
}

// ─── Candidate upsert (idempotent) ───────────────────────────

async function upsertCandidate(
  influencerId: string,
  handle: string,
  tweet: XTweet,
  detection: ReturnType<typeof detectSignals>,
  profileSnapshot: string,
  stats: WatcherStats,
): Promise<void> {
  const dedupKey = `${tweet.id}:${handle}`;

  const existing = await prisma.socialPostCandidate.findUnique({
    where: { dedupKey },
  });

  if (existing) {
    stats.candidatesSkipped++;
    return;
  }

  if (DRY_RUN) {
    console.log(`    [DRY] would create candidate: ${dedupKey} (score=${detection.signalScore})`);
    stats.candidatesCreated++;
    return;
  }

  await prisma.socialPostCandidate.create({
    data: {
      influencerId,
      postId: tweet.id,
      postUrl: `https://x.com/${handle}/status/${tweet.id}`,
      sourceProvider: 'x_api_v2',
      status: 'new',
      postedAtUtc: tweet.created_at ? new Date(tweet.created_at) : null,
      detectedTokens: JSON.stringify(detection.detectedTokens),
      detectedAddresses: JSON.stringify(detection.detectedAddresses),
      signalTypes: JSON.stringify(detection.signalTypes),
      signalScore: detection.signalScore,
      dedupKey,
      profileSnapshot,
    },
  });
  stats.candidatesCreated++;
}

// ─── KolProfile enrichment (existing only) ────────────────────

async function enrichKolProfile(
  handle: string,
  xUser: XUser,
  stats: WatcherStats,
): Promise<void> {
  const existing = await prisma.kolProfile.findUnique({ where: { handle } });
  if (!existing) return;

  const updates: Record<string, unknown> = {};

  if (!existing.followerCount && xUser.public_metrics?.followers_count) {
    updates.followerCount = xUser.public_metrics.followers_count;
  }
  if (!existing.bio && xUser.description) {
    updates.bio = xUser.description;
  }
  if (!existing.displayName && xUser.name) {
    updates.displayName = xUser.name;
  }
  // Always update lastEnrichedAt
  updates.lastEnrichedAt = new Date();

  if (DRY_RUN) {
    console.log(`    [DRY] would enrich KolProfile: ${handle} → ${Object.keys(updates).join(', ')}`);
    stats.profilesEnriched++;
    return;
  }

  await prisma.kolProfile.update({ where: { handle }, data: updates });
  if (Object.keys(updates).length > 1) {
    console.log(`    🔄 enriched KolProfile: ${handle}`);
    stats.profilesEnriched++;
  }
}

// ─── Promotion to draft KolProfile ────────────────────────────

interface TweetWithScore {
  signalScore: number;
}

async function maybePromote(
  handle: string,
  watchEntry: WatchHandle,
  tweetsWithScores: TweetWithScore[],
  stats: WatcherStats,
): Promise<void> {
  // 1. Already in KolProfile? → skip
  const existing = await prisma.kolProfile.findUnique({ where: { handle } });
  if (existing) return;

  // 2. Must be high priority OR have signalScore >= 60 on any tweet
  const isHighPriority = watchEntry.priority === 'high';
  const hasStrongSignal = tweetsWithScores.some((t) => t.signalScore >= 60);
  if (!isHighPriority && !hasStrongSignal) return;

  // 3. Need at least 2 tweets with score >= 20 OR zachxbt_leak source
  const isZachxbt = watchEntry.source === 'zachxbt_leak';
  const qualifyingTweets = tweetsWithScores.filter((t) => t.signalScore >= 20).length;
  if (!isZachxbt && qualifyingTweets < 2) return;

  // Promote via seed engine
  const profile: SeedKolProfile = {
    handle,
    publishStatus: 'draft',
    evidenceStatus: 'weak',
    editorialStatus: 'pending',
    internalNote: 'Auto-detected by WatcherV2 — review required',
  };

  if (DRY_RUN) {
    console.log(`    [DRY] would promote to draft KolProfile: ${handle}`);
    stats.profilesPromoted++;
    return;
  }

  console.log(`    ⬆️  promoting to draft KolProfile: ${handle}`);
  await runSeedBatch([profile]);
  stats.profilesPromoted++;
}

// ─── Real X API cost tracking → XApiUsage (raw SQL) ───────────
//
// Unit price calé sur la facture réelle X (pay-per-use, période
// 2026-05-21 → 06-20): $79.97 / 13 810 posts = ~$0.00579/post.
// → X_API_COST_PER_POST défaut 0.0058 (le $0.10/1000 historique
//   était faux, 58× trop bas). Les user lookups ne sont PAS
//   refacturés par défaut (la facture impute tout aux posts) ;
//   X_API_COST_PER_LOOKUP existe si on veut les modéliser un jour.
//
// Écrit le SCHÉMA RÉEL de la table live (migration 20260321) :
//   monthStart / totalCostUsd / tweetsFetched / userLookups
// PAS le modèle Prisma périmé (month/estimatedUsd) → SQL brut.
//
// Idempotence : appelé EXACTEMENT une fois par run (bloc finally),
// avec les counts réellement consommés. Si la run crashe à mi-
// parcours, on enregistre les reads déjà faits (X les a facturés)
// — pas de double comptage car écriture unique par process.
// Upsert atomique sur l'index unique XApiUsage_monthStart_key
// (posé en prod via Neon SQL Editor) → race-safe.

export async function recordXApiUsage(stats: WatcherStats): Promise<void> {
  const costPerPost = parseFloat(process.env.X_API_COST_PER_POST ?? '0.0058');
  const costPerLookup = parseFloat(process.env.X_API_COST_PER_LOOKUP ?? '0');
  const posts = stats.tweetsFetched;
  const lookups = stats.userLookups;

  if (posts === 0 && lookups === 0) {
    console.log('   💰 XApiUsage: 0 read consommé ce run — aucune écriture.');
    return;
  }

  const runCost = posts * costPerPost + lookups * costPerLookup;

  if (DRY_RUN) {
    console.log(
      `   [DRY] XApiUsage += ${posts} posts, ${lookups} lookups, $${runCost.toFixed(4)} ` +
      `(prix: $${costPerPost}/post, $${costPerLookup}/lookup) — cumul mois courant`,
    );
    return;
  }

  // Upsert atomique sur l'index unique XApiUsage_monthStart_key.
  // Une seule instruction → race-safe même si deux runs se chevauchent.
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
  console.log(`   💰 XApiUsage upsert: +$${runCost.toFixed(4)} (+${posts} posts, +${lookups} lookups)`);
}

// ─── Main scan pipeline ───────────────────────────────────────

export async function runWatcherV2(): Promise<WatcherStats> {
  const stats = emptyStats();

  if (!hasToken()) {
    console.error('❌ X_BEARER_TOKEN / TWITTER_BEARER_TOKEN not set. Exiting.');
    return stats;
  }

  // Spending guard: limit handles per run
  const maxHandles = parseInt(process.env.WATCHER_MAX_HANDLES ?? '50', 10);
  const watchlist = handlesV2.slice(0, maxHandles);

  console.log(`\n🔭 WATCHER V2 — X API Native Scan`);
  console.log(`   Budget mode: scanning ${watchlist.length} of ${handlesV2.length} handles`);
  console.log(`   DRY_RUN: ${DRY_RUN}\n`);

  // Process in batches of 10.
  // try/finally : on enregistre la conso X API réelle exactement
  // une fois, même si la boucle crashe à mi-parcours (les reads
  // déjà faits ont été facturés par X).
  const BATCH_SIZE = 10;
  try {
  for (let i = 0; i < watchlist.length; i += BATCH_SIZE) {
    const batch = watchlist.slice(i, i + BATCH_SIZE);
    console.log(`\n── Batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} handles) ──`);

    for (const entry of batch) {
      const handle = entry.handle;
      console.log(`\n  📡 scanning @${handle}...`);

      // 1. Look up user (1 requête X API facturée, succès ou non)
      const xUser = await getUserByUsername(handle);
      stats.userLookups++;
      if (!xUser) {
        console.log(`    ⚠️  user not found or API error — skipping`);
        stats.handlesFailed++;
        await sleep(1_000);
        continue;
      }
      stats.handlesScanned++;

      const profileSnapshot = JSON.stringify({
        followers: xUser.public_metrics?.followers_count ?? 0,
        following: xUser.public_metrics?.following_count ?? 0,
        tweets: xUser.public_metrics?.tweet_count ?? 0,
        bio: xUser.description?.slice(0, 200) ?? '',
        fetchedAt: new Date().toISOString(),
      });

      // 2. Get recent tweets
      const maxResults = handle === 'GordonGekko' ? 100 : 10;
      const tweets = await getUserTweets(xUser.id, maxResults);
      stats.tweetsFetched += tweets.length;
      console.log(`    ${tweets.length} tweets fetched`);

      // 3. Ensure influencer record
      const influencerId = await ensureInfluencer(handle);

      // 4. Detect signals + create candidates
      const tweetsWithScores: TweetWithScore[] = [];

      for (const tweet of tweets) {
        const detection = detectSignals(tweet.text);
        tweetsWithScores.push({ signalScore: detection.signalScore });

        if (shouldKeep(detection, 20)) {
          await upsertCandidate(influencerId, handle, tweet, detection, profileSnapshot, stats);
          console.log(`    🎯 signal: score=${detection.signalScore} tokens=${detection.detectedTokens.join(',')} types=${detection.signalTypes.join(',')}`);
        }
      }

      // 5. Enrich existing KolProfile
      await enrichKolProfile(handle, xUser, stats);

      // 6. Maybe promote to draft
      await maybePromote(handle, entry, tweetsWithScores, stats);

      // Rate limit: 1s between handles
      await sleep(1_000);
    }
  }
  } finally {
    // Conso X API réelle de ce run → XApiUsage (cumul mois courant)
    await recordXApiUsage(stats);
  }

  // ─── Summary ──────────────────────────────────────────────

  const monthlyEstimate = stats.tweetsFetched * 30;
  const costPerPost = parseFloat(process.env.X_API_COST_PER_POST ?? '0.0058');
  const runCost = stats.tweetsFetched * costPerPost
    + stats.userLookups * parseFloat(process.env.X_API_COST_PER_LOOKUP ?? '0');
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ WATCHER V2 — SCAN COMPLETE`);
  console.log(`   Handles scanned:         ${stats.handlesScanned}`);
  console.log(`   Handles failed:          ${stats.handlesFailed}`);
  console.log(`   Tweets fetched:          ${stats.tweetsFetched}`);
  console.log(`   User lookups:            ${stats.userLookups}`);
  console.log(`   Run cost (X API):        $${runCost.toFixed(4)} (@$${costPerPost}/post)`);
  console.log(`   Candidates created:      ${stats.candidatesCreated}`);
  console.log(`   Candidates skipped:      ${stats.candidatesSkipped}`);
  console.log(`   KolProfiles enriched:    ${stats.profilesEnriched}`);
  console.log(`   KolProfiles promoted:    ${stats.profilesPromoted}`);
  console.log(`   Est. monthly quota:      ~${monthlyEstimate.toLocaleString()} tweets (of 500K budget)`);
  console.log(`${'═'.repeat(50)}\n`);

  await prisma.$disconnect();
  return stats;
}

// ─── CLI entrypoint ───────────────────────────────────────────

if (require.main === module || process.argv[1]?.includes('watcherV2')) {
  runWatcherV2()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
