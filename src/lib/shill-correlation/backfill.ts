// src/lib/shill-correlation/backfill.ts
// PHASE 2 follow-up + PHASE 3 Track 1 orchestrator (recent-window engine).
//
// Steps (per senior arbitration):
//   1. Resolve + tag tickers      (CA_MAP + tweet-text extraction)
//   2. Enrich timestamps via X    (created_at for tweets <= enrichMaxAgeDays)
//   3. Filter to recent window    (<= recentWindowHours, exclude date_only)
//   4. Helius buyer extraction     (dry by default)
//   5. Persist                     (ShillEvent tags + observations) when !dryRun
//
// dryRun (default true) computes everything and writes NOTHING — neither the
// ShillEvent resolution/timestamp tags nor the buyer observations. The resolved
// mint and enriched timestamp are threaded in-memory into the Helius step so a
// full dry-run needs no prior DB write.

import { prisma } from "@/lib/prisma";
import {
  resolveTokenMint,
  resolveWithTweetText,
  type ResolutionStatus,
} from "./resolve";
import { fetchTweetMeta, isDateOnly, type TimestampSource } from "./enrich";
import { persistBuyerObservations } from "./process";
import { fetchMintTransactionsInRange } from "./helius";
import { extractBuyerObservations } from "./buyers";
import { ANALYSIS_WINDOW } from "./types";
import type { BuyerFetchResult, BuyerObservationDraft } from "./types";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const isNumericTweetId = (s: string) => /^[0-9]{8,25}$/.test(s);

interface RawEvent {
  id: string;
  tokenMint: string;
  tweetId: string;
  chain: string;
  tweetTimestamp: Date;
}

export interface EventPlan {
  id: string;
  tweetId: string;
  chain: string;
  originalMint: string;
  resolvedMint: string | null;
  tokenTicker: string | null;
  resolutionStatus: ResolutionStatus;
  originalTimestamp: Date;
  effectiveTimestamp: Date;
  timestampSource: TimestampSource;
  fetchedTweet: boolean;
  inRecentWindow: boolean;
  eligibleForHelius: boolean;
}

export interface Phase2FollowupReport {
  dryRun: boolean;
  totalEvents: number;
  tweetsRequested: number;
  tweetsResolved: number;
  resolutionCounts: Record<string, number>;
  timestampCounts: Record<string, number>;
  recentWindowCount: number;
  recentExcludedDateOnly: number;
  recentUnresolvedMint: number;
  eligibleForHeliusCount: number;
  distinctMintsFetched: number;
  heliusResults: BuyerFetchResult[];
  heliusSummary: {
    events: number;
    distinctMints: number;
    totalPages: number; // mint-level (one super-window fetch per distinct mint)
    totalObservations: number;
    totalAmbiguous: number;
    incompleteWindows: number;
    errored: number;
  };
  writes?: { eventsUpdated: number; observationsWritten: number; updateErrors: string[] };
}

export interface Phase2FollowupOptions {
  dryRun?: boolean;
  recentWindowHours?: number;
  enrichMaxAgeDays?: number;
  heliusMaxPages?: number;
}

function tally<T extends string>(items: T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) out[i] = (out[i] ?? 0) + 1;
  return out;
}

export async function runPhase2Followup(
  opts: Phase2FollowupOptions = {},
): Promise<Phase2FollowupReport> {
  const dryRun = opts.dryRun ?? true;
  const recentHours = opts.recentWindowHours ?? 72;
  const enrichDays = opts.enrichMaxAgeDays ?? 7;
  const nowMs = Date.now();

  const events = (await prisma.shillEvent.findMany({
    select: {
      id: true,
      tokenMint: true,
      tweetId: true,
      chain: true,
      tweetTimestamp: true,
    },
  })) as RawEvent[];

  // Step 2 scope: fetch tweets for numeric ids within enrichMaxAgeDays.
  const toFetch = events.filter(
    (e) =>
      isNumericTweetId(e.tweetId) &&
      nowMs - e.tweetTimestamp.getTime() <= enrichDays * DAY_MS,
  );
  const meta = toFetch.length
    ? await fetchTweetMeta(toFetch.map((e) => e.tweetId))
    : new Map();

  // Steps 1-3: build a plan per event.
  const plans: EventPlan[] = events.map((e) => {
    const tm = meta.get(e.tweetId);
    const fetchedTweet = !!tm;

    const res = fetchedTweet
      ? resolveWithTweetText(e.tokenMint, tm.text)
      : resolveTokenMint(e.tokenMint);

    let effectiveTimestamp = e.tweetTimestamp;
    let timestampSource: TimestampSource;
    if (tm?.createdAt) {
      effectiveTimestamp = tm.createdAt;
      timestampSource = "x_api";
    } else if (isDateOnly(e.tweetTimestamp)) {
      timestampSource = "date_only";
    } else {
      timestampSource = "source";
    }

    const ageMs = nowMs - effectiveTimestamp.getTime();
    const inRecentWindow = ageMs >= 0 && ageMs <= recentHours * HOUR_MS;
    const eligibleForHelius =
      inRecentWindow &&
      timestampSource !== "date_only" &&
      !!res.mint &&
      e.chain === "solana";

    return {
      id: e.id,
      tweetId: e.tweetId,
      chain: e.chain,
      originalMint: e.tokenMint,
      resolvedMint: res.mint,
      tokenTicker: res.ticker,
      resolutionStatus: res.status,
      originalTimestamp: e.tweetTimestamp,
      effectiveTimestamp,
      timestampSource,
      fetchedTweet,
      inRecentWindow,
      eligibleForHelius,
    };
  });

  // Step 4: Helius extraction with MINT-DEDUP. One super-window fetch per
  // distinct mint covering [min(tweetTs)-pre, max(tweetTs)+post] across all
  // events sharing it; each event's observations are sliced from that fetch.
  const eligible = plans.filter((p) => p.eligibleForHelius);
  const pre = ANALYSIS_WINDOW.preSeconds;
  const post = ANALYSIS_WINDOW.postSeconds;

  const byMint = new Map<string, EventPlan[]>();
  for (const p of eligible) {
    const arr = byMint.get(p.resolvedMint as string) ?? [];
    arr.push(p);
    byMint.set(p.resolvedMint as string, arr);
  }

  const extractions: Array<{
    plan: EventPlan;
    drafts: BuyerObservationDraft[];
    result: BuyerFetchResult;
  }> = [];
  let totalMintPages = 0;

  for (const [mint, group] of byMint) {
    const tweetSecs = group.map((p) =>
      Math.floor(p.effectiveTimestamp.getTime() / 1000),
    );
    const rangeStart = Math.min(...tweetSecs.map((s) => s - pre));
    const rangeEnd = Math.max(...tweetSecs.map((s) => s + post));

    let fetched;
    try {
      fetched = await fetchMintTransactionsInRange(mint, rangeStart, rangeEnd, {
        maxPages: opts.heliusMaxPages,
      });
    } catch (e) {
      for (const p of group) {
        extractions.push({
          plan: p,
          drafts: [],
          result: {
            shillEventId: p.id,
            tokenMint: mint,
            status: "errored",
            pagesFetched: 0,
            windowCovered: false,
            txInWindow: 0,
            observations: 0,
            ambiguous: 0,
            written: false,
            error: `helius: ${(e as Error).message}`,
          },
        });
      }
      continue;
    }
    totalMintPages += fetched.pagesFetched;

    for (const p of group) {
      const tweetTs = Math.floor(p.effectiveTimestamp.getTime() / 1000);
      const eWS = tweetTs - pre;
      const eWE = tweetTs + post;
      const evTxs = fetched.txs.filter(
        (t) => t.timestamp >= eWS && t.timestamp <= eWE,
      );
      const drafts = extractBuyerObservations(evTxs, mint, tweetTs, p.chain);
      // Per-event coverage: the shared fetch reached this event's window start.
      const covered = fetched.windowCovered || fetched.oldestTsSeen <= eWS;
      extractions.push({
        plan: p,
        drafts,
        result: {
          shillEventId: p.id,
          tokenMint: mint,
          status: "buyers_fetched",
          pagesFetched: 0, // attributed at mint level (totalMintPages)
          windowCovered: covered,
          txInWindow: evTxs.length,
          observations: drafts.length,
          ambiguous: drafts.filter((d) => d.isAmbiguous).length,
          written: false,
        },
      });
    }
  }

  const heliusResults = extractions.map((x) => x.result);
  const recentPlans = plans.filter((p) => p.inRecentWindow);
  const report: Phase2FollowupReport = {
    dryRun,
    totalEvents: events.length,
    tweetsRequested: toFetch.length,
    tweetsResolved: meta.size,
    resolutionCounts: tally(plans.map((p) => p.resolutionStatus)),
    timestampCounts: tally(plans.map((p) => p.timestampSource)),
    recentWindowCount: recentPlans.length,
    recentExcludedDateOnly: recentPlans.filter(
      (p) => p.timestampSource === "date_only",
    ).length,
    recentUnresolvedMint: recentPlans.filter((p) => !p.resolvedMint).length,
    eligibleForHeliusCount: eligible.length,
    distinctMintsFetched: byMint.size,
    heliusResults,
    heliusSummary: {
      events: heliusResults.length,
      distinctMints: byMint.size,
      totalPages: totalMintPages,
      totalObservations: heliusResults.reduce((s, r) => s + r.observations, 0),
      totalAmbiguous: heliusResults.reduce((s, r) => s + r.ambiguous, 0),
      incompleteWindows: heliusResults.filter((r) => !r.windowCovered).length,
      errored: heliusResults.filter((r) => r.error).length,
    },
  };

  if (dryRun) return report;

  // Step 5 (write mode): persist ShillEvent tags, then buyer observations.
  const updateErrors: string[] = [];
  let eventsUpdated = 0;
  for (const p of plans) {
    try {
      await prisma.shillEvent.update({
        where: { id: p.id },
        data: {
          tokenMint: p.resolvedMint ?? p.originalMint,
          tokenTicker: p.tokenTicker,
          resolutionStatus: p.resolutionStatus,
          tweetTimestamp: p.effectiveTimestamp,
          timestampSource: p.timestampSource,
        },
      });
      eventsUpdated++;
    } catch (e) {
      // Upgrading tokenMint can collide on (kolHandle, tweetId, tokenMint).
      updateErrors.push(`${p.id}: ${(e as Error).message}`.slice(0, 200));
    }
  }

  // Reuse drafts already extracted above — no second Helius fetch.
  let observationsWritten = 0;
  for (const x of extractions) {
    if (x.result.error) continue;
    const r = await persistBuyerObservations(x.plan.id, x.drafts);
    if (r.written) observationsWritten += x.drafts.length;
  }

  report.writes = { eventsUpdated, observationsWritten, updateErrors };
  return report;
}
