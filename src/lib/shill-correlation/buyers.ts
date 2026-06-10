// src/lib/shill-correlation/buyers.ts
// PHASE 3 — pure buyer-extraction + timing classification (no I/O, unit-tested).
//
// Turns a window of parsed Helius transactions into one BuyerObservationDraft
// per wallet that ACQUIRED the target mint, recording the earliest acquisition
// inside the window. Ambiguous acquisitions (non-swap inflows, or wallets that
// also disposed of the mint in-window) are flagged, never discarded.

import { ANALYSIS_WINDOW, type BehaviorZone, type BehaviorType } from "./types";
import type { BuyerObservationDraft } from "./types";

/** Minimal shape we consume from a Helius enhanced transaction. */
export interface MinimalTx {
  signature: string;
  timestamp: number; // unix seconds
  type: string; // e.g. "SWAP", "TRANSFER", "UNKNOWN"
  tokenTransfers?: Array<{
    fromUserAccount?: string;
    toUserAccount?: string;
    mint: string;
    tokenAmount: number;
  }>;
}

/**
 * True when `s` is a plausible base58 Solana mint address (32-44 chars, no
 * 0OIl). Guards the Helius path against ShillEvents whose tokenMint is actually
 * a ticker symbol (e.g. "PHOTO") rather than an on-chain address.
 */
export function looksLikeSolanaMint(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

/**
 * Classify a buy's timing relative to the tweet, using the asymmetric zone
 * bounds from ANALYSIS_WINDOW:
 *   delta <  -30s        -> pre_tweet  (zone_a)  front-run signal
 *   -30s <= delta <= 90s -> near_tweet (zone_b)  near-simultaneous
 *   delta >   90s        -> post_tweet (zone_c)  retail reaction
 */
export function classifyTiming(deltaSeconds: number): {
  zone: BehaviorZone;
  type: BehaviorType;
} {
  const { zoneBStartSeconds: lo, zoneBEndSeconds: hi } = ANALYSIS_WINDOW;
  if (deltaSeconds < lo) return { zone: "zone_a", type: "pre_tweet" };
  if (deltaSeconds <= hi) return { zone: "zone_b", type: "near_tweet" };
  return { zone: "zone_c", type: "post_tweet" };
}

interface Acquisition {
  ts: number;
  amount: number;
  signature: string;
  txType: string;
}

/**
 * Extract per-wallet earliest acquisitions of `mint` from window transactions.
 * `tweetTsSeconds` anchors the delta/zone classification. `chain` is stamped
 * onto every draft. Transactions are assumed pre-filtered to the window by the
 * caller (fetchTokenWindowTransactions), but out-of-window txs are tolerated.
 */
export function extractBuyerObservations(
  txs: MinimalTx[],
  mint: string,
  tweetTsSeconds: number,
  chain: string,
): BuyerObservationDraft[] {
  // earliest inflow per wallet, and whether the wallet also disposed in-window
  const inflow = new Map<string, Acquisition>();
  const disposed = new Set<string>();

  for (const tx of txs) {
    for (const t of tx.tokenTransfers ?? []) {
      if (t.mint !== mint) continue;
      if (t.fromUserAccount) disposed.add(t.fromUserAccount);

      const wallet = t.toUserAccount;
      if (!wallet || !(t.tokenAmount > 0)) continue;

      const prev = inflow.get(wallet);
      if (!prev || tx.timestamp < prev.ts) {
        inflow.set(wallet, {
          ts: tx.timestamp,
          amount: t.tokenAmount,
          signature: tx.signature,
          txType: tx.type,
        });
      }
    }
  }

  const drafts: BuyerObservationDraft[] = [];
  for (const [wallet, acq] of inflow) {
    const delta = acq.ts - tweetTsSeconds;
    const { zone, type } = classifyTiming(delta);

    const reasons: string[] = [`acq via ${acq.txType}`];
    const notSwap = acq.txType !== "SWAP";
    const roundTrip = disposed.has(wallet);
    if (notSwap) reasons.push("non-swap inflow (transfer/airdrop?)");
    if (roundTrip) reasons.push("also disposed mint in-window");

    drafts.push({
      wallet,
      chain,
      firstSeenAt: new Date(acq.ts * 1000),
      deltaSecondsFromTweet: delta,
      entryAmountToken: acq.amount,
      entryAmountUsd: null, // no historical price feed in PHASE 3
      exitAmountUsd: null,
      exitDeltaSeconds: null,
      behaviorZone: zone,
      behaviorType: type,
      isAmbiguous: notSwap || roundTrip,
      firstBuyTxSignature: acq.signature,
      notes: reasons.join("; "),
    });
  }

  // Deterministic order: earliest buyers first.
  drafts.sort((a, b) => a.deltaSecondsFromTweet - b.deltaSecondsFromTweet);
  return drafts;
}
