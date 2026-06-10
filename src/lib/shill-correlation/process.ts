// src/lib/shill-correlation/process.ts
// PHASE 3 — orchestrator: fetch on-chain buyers for pending ShillEvents,
// persist ShillBuyerObservation rows, advance processingStatus.
//
// pending -> buyers_fetched on success, -> errored on failure.
// Idempotent: a re-processed event's observations are replaced atomically
// (deleteMany + createMany + status update in one transaction).
// Solana only in PHASE 3; other chains are marked errored with a note.

import { prisma } from "@/lib/prisma";
import {
  fetchTokenWindowTransactions,
  type WindowFetchOptions,
} from "./helius";
import { extractBuyerObservations, looksLikeSolanaMint } from "./buyers";
import type { BuyerFetchResult, BuyerObservationDraft } from "./types";

/**
 * Persist a single event's buyer observations idempotently: replace any prior
 * observations and advance processingStatus, all in one transaction. On failure
 * the event is flagged errored (best-effort) so it stays retriable. Shared by
 * processShillEvent and the mint-dedup path in backfill.ts.
 */
export async function persistBuyerObservations(
  eventId: string,
  drafts: BuyerObservationDraft[],
): Promise<{ written: boolean; error?: string }> {
  try {
    await prisma.$transaction([
      prisma.shillBuyerObservation.deleteMany({ where: { shillEventId: eventId } }),
      prisma.shillBuyerObservation.createMany({
        data: drafts.map((d) => ({
          shillEventId: eventId,
          wallet: d.wallet,
          chain: d.chain,
          firstSeenAt: d.firstSeenAt,
          deltaSecondsFromTweet: d.deltaSecondsFromTweet,
          entryAmountToken: d.entryAmountToken,
          entryAmountUsd: d.entryAmountUsd,
          exitAmountUsd: d.exitAmountUsd,
          exitDeltaSeconds: d.exitDeltaSeconds,
          behaviorZone: d.behaviorZone,
          behaviorType: d.behaviorType,
          isAmbiguous: d.isAmbiguous,
          firstBuyTxSignature: d.firstBuyTxSignature,
          notes: d.notes,
        })),
        skipDuplicates: true,
      }),
      prisma.shillEvent.update({
        where: { id: eventId },
        data: { processingStatus: "buyers_fetched" },
      }),
    ]);
    return { written: true };
  } catch (e) {
    try {
      await prisma.shillEvent.update({
        where: { id: eventId },
        data: { processingStatus: "errored" },
      });
    } catch {
      /* leave as-is */
    }
    return { written: false, error: (e as Error).message };
  }
}

export interface ProcessOptions extends WindowFetchOptions {
  /** Build observations but do not write or change processingStatus. */
  dryRun?: boolean;
}

interface ShillEventRow {
  id: string;
  tokenMint: string;
  chain: string;
  tweetTimestamp: Date;
}

/** Process one ShillEvent end to end. Never throws — errors land in the result. */
export async function processShillEvent(
  event: ShillEventRow,
  opts: ProcessOptions = {},
): Promise<BuyerFetchResult> {
  const base: BuyerFetchResult = {
    shillEventId: event.id,
    tokenMint: event.tokenMint,
    status: "errored",
    pagesFetched: 0,
    windowCovered: false,
    txInWindow: 0,
    observations: 0,
    ambiguous: 0,
    written: false,
  };

  if (event.chain !== "solana") {
    return { ...base, error: `unsupported chain: ${event.chain}` };
  }
  // Many ShillEvents (from SocialPostCandidate cashtags) carry a ticker symbol
  // in tokenMint rather than an address — Helius would 400. Short-circuit
  // before spending a credit; these need upstream symbol->mint resolution.
  if (!looksLikeSolanaMint(event.tokenMint)) {
    return {
      ...base,
      error: `tokenMint is not a base58 address (symbol?): ${event.tokenMint}`,
    };
  }

  const tweetTs = Math.floor(event.tweetTimestamp.getTime() / 1000);

  let win;
  try {
    win = await fetchTokenWindowTransactions(event.tokenMint, tweetTs, opts);
  } catch (e) {
    return { ...base, error: `helius: ${(e as Error).message}` };
  }

  const drafts = extractBuyerObservations(
    win.txs,
    event.tokenMint,
    tweetTs,
    event.chain,
  );
  const ambiguous = drafts.filter((d) => d.isAmbiguous).length;

  const result: BuyerFetchResult = {
    ...base,
    status: "buyers_fetched",
    pagesFetched: win.pagesFetched,
    windowCovered: win.windowCovered,
    txInWindow: win.txs.length,
    observations: drafts.length,
    ambiguous,
  };

  if (opts.dryRun) return result;

  // NOTE: ShillEvent has no notes column, so incomplete-window coverage
  // (win.windowCovered === false) is surfaced only via BuyerFetchResult/logs.
  const persisted = await persistBuyerObservations(event.id, drafts);
  if (!persisted.written) {
    return { ...base, error: `persist: ${persisted.error}` };
  }
  return { ...result, written: true };
}

export interface SampleOptions extends ProcessOptions {
  /** Max events to process. */
  limit?: number;
  /** Restrict to a single token mint (dry-sample on 1-2 mints). */
  mint?: string;
}

/**
 * Process a sample of pending events (most recent tweets first — cheapest to
 * page to). Defaults to dryRun so a sample never writes unless asked.
 */
export async function processPendingSample(
  opts: SampleOptions = {},
): Promise<BuyerFetchResult[]> {
  const dryRun = opts.dryRun ?? true;
  const limit = opts.limit ?? 2;

  // When no explicit mint is given, over-fetch and keep only address-shaped
  // mints (symbol-only events would just error against Helius).
  const candidates = await prisma.shillEvent.findMany({
    where: {
      processingStatus: "pending",
      ...(opts.mint ? { tokenMint: opts.mint } : {}),
    },
    orderBy: { tweetTimestamp: "desc" },
    take: opts.mint ? limit : Math.min(limit * 20, 500),
    select: { id: true, tokenMint: true, chain: true, tweetTimestamp: true },
  });

  const events = (
    opts.mint
      ? candidates
      : candidates.filter((e) => looksLikeSolanaMint(e.tokenMint))
  ).slice(0, limit);

  const results: BuyerFetchResult[] = [];
  for (const ev of events) {
    results.push(await processShillEvent(ev, { ...opts, dryRun }));
  }
  return results;
}
