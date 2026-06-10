// src/lib/shill-correlation/helius.ts
// PHASE 3 — Helius adapter for the Shill Correlation Engine (Solana only).
//
// Reuses the hardened client in src/lib/mm/data/helius.ts (retry/backoff,
// HELIUS_API_KEY). The Enhanced Transactions API
//   GET https://api.helius.xyz/v0/addresses/{mint}/transactions
// returns parsed token transfers but offers NO timestamp seek — only a
// `before` signature cursor, newest-first. To collect a historical window we
// page backward from "now" and stop once we cross the window start, bounded by
// a page budget. See "Known blind spots" at the bottom of this file.

import { fetchSolanaTransactions, type HeliusTx } from "@/lib/mm/data/helius";
import { ANALYSIS_WINDOW } from "./types";

export interface WindowFetchOptions {
  /** Hard cap on pages (100 tx/page) to bound credit spend per event. */
  maxPages?: number;
  /** Injected for tests. */
  fetchTxs?: typeof fetchSolanaTransactions;
  /** Forwarded to the Helius client (apiKey, retries, fetchImpl). */
  fetchOpts?: Parameters<typeof fetchSolanaTransactions>[2];
}

export interface WindowFetchResult {
  /** Transactions whose unix timestamp falls within [start, end]. */
  txs: HeliusTx[];
  pagesFetched: number;
  /**
   * True when we are confident the whole window was seen: we either paged back
   * to a tx older than the window start, or exhausted the token's history.
   * False means the page budget was hit first — the window may be incomplete.
   */
  windowCovered: boolean;
  windowStart: number;
  windowEnd: number;
  /** Oldest tx timestamp observed across all fetched pages (0 if none). */
  oldestTsSeen: number;
}

const DEFAULT_MAX_PAGES = 12; // 12 * 100 = 1200 tx max scanned per fetch

/**
 * Collect every transaction touching `mint` within [windowStart, windowEnd]
 * (unix seconds). Pages newest-first until it crosses windowStart or hits the
 * page budget. This is the shared core; callers anchor on a tweet or pass an
 * explicit range (mint-dedup super-window).
 */
export async function fetchMintTransactionsInRange(
  mint: string,
  windowStart: number,
  windowEnd: number,
  opts: WindowFetchOptions = {},
): Promise<WindowFetchResult> {
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const fetchTxs = opts.fetchTxs ?? fetchSolanaTransactions;

  const txs: HeliusTx[] = [];
  let before: string | undefined;
  let pagesFetched = 0;
  let windowCovered = false;
  let oldestTsSeen = 0;

  while (pagesFetched < maxPages) {
    const page = await fetchTxs(mint, { limit: 100, before }, opts.fetchOpts);
    pagesFetched++;
    if (page.length === 0) {
      windowCovered = true; // exhausted history
      break;
    }
    for (const tx of page) {
      if (tx.timestamp >= windowStart && tx.timestamp <= windowEnd) txs.push(tx);
    }
    const last = page[page.length - 1];
    oldestTsSeen = last.timestamp;
    before = last.signature;
    if (last.timestamp < windowStart) {
      windowCovered = true; // paged past the window start
      break;
    }
  }

  return { txs, pagesFetched, windowCovered, windowStart, windowEnd, oldestTsSeen };
}

/**
 * Per-event convenience wrapper: window = tweetTs +/- ANALYSIS_WINDOW.
 */
export async function fetchTokenWindowTransactions(
  mint: string,
  tweetTsSeconds: number,
  opts: WindowFetchOptions = {},
): Promise<WindowFetchResult> {
  return fetchMintTransactionsInRange(
    mint,
    tweetTsSeconds - ANALYSIS_WINDOW.preSeconds,
    tweetTsSeconds + ANALYSIS_WINDOW.postSeconds,
    opts,
  );
}

// ─── Known blind spots (documented for the PHASE 3 checkpoint) ───────────────
//
// 1. NO TIMESTAMP SEEK. The Enhanced API only cursors by `before` signature,
//    newest-first. For an OLD tweet on a still-active token we must fetch &
//    discard every tx newer than the window before reaching it — credit cost
//    grows with token age * activity. `maxPages` bounds this; when the budget
//    is hit, `windowCovered=false` and the window is reported as incomplete
//    rather than silently truncated.
// 2. MINT-ADDRESS INDEXING. We query the mint's address-transactions. Helius
//    surfaces swaps/transfers that reference the mint, but a program that moves
//    the token without referencing the mint account can be missed. The dry
//    sample measures how much real swap activity this actually returns.
// 3. POOL / ROUTER RECIPIENTS. A `toUserAccount` may be an AMM pool, router, or
//    intermediary rather than an end buyer. PHASE 3 does not maintain a
//    known-program denylist; such acquisitions are flagged ambiguous, not
//    dropped, so PHASE 4 can decide.
// 4. NO USD PRICING. entryAmountUsd / exit fields are left null in PHASE 3 (no
//    historical price feed wired here); only token amounts + signatures are
//    captured for evidence.
