// src/lib/shill-correlation/types.ts
// Shared types & constants for the Shill Correlation Engine (shadow mode).
// PHASE 2 — ingestion layer. No public surface, no TigerScore coupling,
// no PDF/email coupling. Wording invariant: candidates, never "the KOL's wallet".

// La grammaire de resolution vit dans resolve.ts et n'est pas redupliquee ici.
// Import de TYPE uniquement : efface a la compilation, donc aucun cycle a
// l'execution malgre resolve.ts -> buyers.ts -> types.ts.
import type { ResolutionStatus } from "./resolve";

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
  /** `null` quand l'evenement n'a pas d'identite de contrat resolue. */
  tokenMint: string | null;
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
/**
 * ══ B0 — UN TICKER N'EST JAMAIS UNE IDENTITE DE CONTRAT ══════════════════
 *
 * LE DEFAUT FERME ICI, mesure le 2026-09-03 : `ingestShillEvents` ecrivait le
 * contenu de `detectedTokens` dans `tokenMint` et ne posait JAMAIS
 * `resolutionStatus`. Le defaut base `@default("resolved_direct")` s'appliquait
 * donc a des lignes portant un TICKER. Sur 30 jours, 841 entrees de
 * `detectedTokens` sur 841 sont des tickers - zero adresse. Chaque evenement
 * cree aurait affirme « mint resolu directement » sur un symbole.
 *
 * Une affirmation fausse posee par OMISSION est le pire des deux mondes : rien
 * dans le code ne la porte, donc rien ne la signale a la relecture.
 *
 * DEUX CHANGEMENTS DE TYPE, ET ILS SONT LE CORRECTIF :
 *
 *   `tokenMint: string | null` - un draft dont l'identite n'est pas resolue
 *   porte `null`, PAS le ticker. Le ticker reste dans `rawToken`, ou il est
 *   lisible sans etre confondu avec une adresse. La colonne `tokenMint` etant
 *   NOT NULL en base, un draft a `null` n'est tout simplement PAS persiste :
 *   on n'invente pas l'identite qui manque.
 *
 *   `resolutionStatus` OBLIGATOIRE - le type force chaque frontiere de
 *   creation a trancher. Il n'existe plus de chemin ou l'omission decide a
 *   la place de l'auteur.
 *
 * Aucun etat nouveau : la grammaire est celle de resolve.ts.
 * B0 est FORWARD-ONLY. Les 221 evenements deja en base ne sont pas touches.
 */
export interface ShillEventDraft {
  kolHandle: string;
  tweetId: string;
  tweetTimestamp: Date;
  /** `null` quand l'identite n'est pas resolue. JAMAIS un ticker. */
  tokenMint: string | null;
  /** La valeur brute lue en amont - ticker ou adresse. Auditable, jamais ecrite comme mint. */
  rawToken: string;
  /** EXPLICITE, toujours. Jamais laisse au defaut base. */
  resolutionStatus: ResolutionStatus;
  chain: Chain;
  sourcePostCandidateId: string | null;
  campaignId: string | null;
}

/** Counters returned by an ingestion run (per-source and aggregate). */
export interface IngestSummary {
  scannedPromotionMentions: number;
  scannedPostCandidates: number;
  draftsBuilt: number;
  /**
   * B0 - drafts CONSTRUITS mais NON persistes faute d'identite de contrat.
   * Comptes plutot que tus : un chiffre qui monte sans que rien ne soit cree
   * est le signal que la resolution (B1) manque, pas que la source est vide.
   */
  skippedUnresolved: number;
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
