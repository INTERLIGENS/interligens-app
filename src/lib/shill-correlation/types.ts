// src/lib/shill-correlation/types.ts
// Shared types & constants for the Shill Correlation Engine (shadow mode).
// PHASE 2 — ingestion layer. No public surface, no TigerScore coupling,
// no PDF/email coupling. Wording invariant: candidates, never "the KOL's wallet".

/** Processing lifecycle of a ShillEvent row. */
export type ShillEventStatus =
  | "pending"
  | "buyers_fetched"
  | "scored"
  | "errored";

/** Chain identifier, normalized lowercase ("solana" | "ethereum" | ...). */
export type Chain = string;

/**
 * Analysis window around a shill tweet, in seconds. Consumed by the
 * buyer-fetch phase; defined here so every phase shares one source of truth.
 *
 * Asymmetric zone bounds (senior arbitration, 2026-06-09):
 *   zone_a / pre_tweet  : [-10m, -30s)   delta <  -30   max suspicion (front-run)
 *   zone_b / near_tweet : [-30s, +90s]   -30 <= delta <= 90   near-simultaneous
 *   zone_c / post_tweet : (+90s, +15m]   delta >  90   retail reaction
 *
 *   tweetTs-600 ........... tweetTs-30 ... tweetTs ... tweetTs+90 ........... tweetTs+900
 *   |<----- zone_a ------->|<-------- zone_b -------->|<-------- zone_c ----------->|
 */
export const ANALYSIS_WINDOW = {
  preSeconds: 600, // -10m  (earliest buy we still attribute to the tweet)
  postSeconds: 900, // +15m  (latest buy we still attribute to the tweet)
  zoneBStartSeconds: -30, // zone_b lower bound, inclusive (delta >= this)
  zoneBEndSeconds: 90, // zone_b upper bound, inclusive (delta <= this)
} as const;

/** Candidate triage workflow (PHASE 5 admin review surface). */
export const REVIEW_STATUSES = [
  "draft",
  "confirmed",
  "dismissed",
  "needs_data",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Candidate classification produced by the scoring engine (PHASE 4). */
export const CLASSIFICATIONS = ["watch", "candidate", "high_interest"] as const;

/** Scoring zone — short code stored alongside the human-readable type. */
export type BehaviorZone = "zone_a" | "zone_b" | "zone_c";

/** Timing bucket relative to the tweet. Parallel to BehaviorZone. */
export type BehaviorType = "pre_tweet" | "near_tweet" | "post_tweet";

/**
 * A normalized buyer observation ready to persist. Maps to the business
 * columns of ShillBuyerObservation (id/createdAt assigned by the DB).
 * shillEventId is supplied by the orchestrator at write time.
 */
export interface BuyerObservationDraft {
  wallet: string;
  chain: Chain;
  firstSeenAt: Date;
  deltaSecondsFromTweet: number;
  entryAmountToken: number | null;
  entryAmountUsd: number | null;
  exitAmountUsd: number | null;
  exitDeltaSeconds: number | null;
  behaviorZone: BehaviorZone;
  behaviorType: BehaviorType;
  isAmbiguous: boolean;
  firstBuyTxSignature: string | null;
  notes: string | null;
}

/** Outcome of processing a single ShillEvent's buyer window. */
export interface BuyerFetchResult {
  shillEventId: string;
  tokenMint: string;
  status: ShillEventStatus; // buyers_fetched | errored
  pagesFetched: number;
  windowCovered: boolean; // false => paged budget hit before window start
  txInWindow: number;
  observations: number;
  ambiguous: number;
  written: boolean;
  error?: string;
}

/**
 * A normalized, source-agnostic ShillEvent ready to be persisted. Maps 1:1 to
 * the ShillEvent table's business columns; id/createdAt/updatedAt are assigned
 * by the database, and processingStatus defaults to "pending".
 */
export interface ShillEventDraft {
  kolHandle: string;
  tweetId: string;
  tweetTimestamp: Date;
  tokenMint: string;
  chain: Chain;
  sourcePostCandidateId: string | null;
  campaignId: string | null;
}

/** Counters returned by an ingestion run (per-source and aggregate). */
export interface IngestSummary {
  scannedPromotionMentions: number;
  scannedPostCandidates: number;
  draftsBuilt: number;
  created: number; // rows actually inserted (new)
  skippedDuplicates: number; // already present on the unique key
  skippedInvalid: number; // source rows that produced no valid draft
  errors: string[];
}

export interface IngestOptions {
  /** Only consider source rows posted at/after this instant. */
  since?: Date;
  /** Hard cap on source rows scanned per table (safety in shadow mode). */
  limit?: number;
  /** When true, build drafts but do not write to the DB. */
  dryRun?: boolean;
}
