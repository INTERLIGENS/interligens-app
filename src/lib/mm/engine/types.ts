// ─── Pattern Engine types ──────────────────────────────────────────────────
// Everything in this file must be serialisable and I/O-free. Detectors are
// pure functions: they take typed input, return typed output, and never touch
// the network, the filesystem, or the database.
//
// ABSOLUTE RULE (spec §4.2 / §7 preamble): detectors never emit the name of
// a real-world entity. Any clustering is represented with an anonymous
// internalClusterId. Entity attribution lives in the Registry.

import type { MmChain, MmSubjectType } from "../types";

// ─── Severity ──────────────────────────────────────────────────────────────

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// ─── Signal shape (shared) ─────────────────────────────────────────────────

export interface DetectorSignal {
  type: string;
  severity: Severity;
  description?: string;
  metric?: number;
  baseline?: number;
  extra?: Record<string, unknown>;
}

export interface DetectorOutput {
  detectorType: DetectorType;
  score: number;
  maxScore: number;
  signals: DetectorSignal[];
  evidence: Record<string, unknown>;
  durationMs: number;
}

export type DetectorType =
  | "WASH_TRADING"
  | "CLUSTER_COORDINATION"
  | "CONCENTRATION_ABNORMALITY"
  | "PRICE_ASYMMETRY"
  | "POST_LISTING_PUMP"
  | "KNOWN_ENTITY_FLOOR"
  | "FAKE_LIQUIDITY";

// ─── Wash Trading ──────────────────────────────────────────────────────────

export interface WashTradeTx {
  hash: string;
  buyer: string;
  seller: string;
  tokenId: string;
  volumeUsd: number;
  side: "BUY" | "SELL";
  block: number;
  timestamp: number; // unix seconds
}

export interface WashTradingInput {
  tokenId: string;
  chain: MmChain;
  txs: WashTradeTx[];
  /**
   * Window in unix seconds. Used for MIRRORED sub-signal (typically 1h).
   */
  mirroredWindowSeconds?: number;
  /**
   * Block window for ROUND_TRIP detection (default 100).
   */
  roundTripBlockWindow?: number;
  /**
   * Cluster mapping from wallet → internalClusterId (optional). When passed
   * in, MIRRORED aggregates per-cluster; otherwise it falls back to a global
   * buy/sell ratio over the window.
   */
  clusterMap?: Map<string, string>;
  /**
   * Cohort percentiles (Phase 3). When present the detector uses p99 bands
   * instead of the Phase 2 hard-coded thresholds.
   */
  percentiles?: CohortPercentiles;
}

export interface RoundTrip {
  origin: string;
  via: string;
  firstBlock: number;
  lastBlock: number;
  hops: string[];
}

// ─── Cluster Mapper ────────────────────────────────────────────────────────

export interface FundingTx {
  hash: string;
  from: string;
  to: string;
  amountUsd: number;
  block: number;
  timestamp: number; // unix seconds
}

export interface TokenActivity {
  wallet: string;
  tokenId: string;
  firstSeen: number;
  lastSeen: number;
  totalVolumeUsd: number;
  txCount: number;
}

export interface ClusterInput {
  /**
   * Target wallet the cluster analysis is seeded from.
   */
  targetWallet: string;
  chain: MmChain;
  /**
   * Edges of the funding graph, in any order. Direction is from → to.
   */
  fundingEdges: FundingTx[];
  /**
   * Records of on-token activity for the wallets in the funding graph.
   */
  tokenActivity: TokenActivity[];
  /**
   * How many hops back to expand from each wallet when searching for
   * a shared funding root. Spec: 3 levels.
   */
  maxDepth?: number;
  /**
   * Minimum number of wallets sharing a root AND a token for a cluster to
   * be declared. Spec: "plus de N wallets" — default 6 (> 5). Overridden by
   * `percentiles.clusterSize.p99` when percentiles are provided.
   */
  minClusterSize?: number;
  /**
   * Cohort percentiles (Phase 3). When present the detector raises
   * minClusterSize to the cohort's P99 for clusterSize, so only statistically
   * unusual clusters count.
   */
  percentiles?: CohortPercentiles;
  /**
   * Now() override for deterministic tests.
   */
  nowSeconds?: number;
}

export interface Cluster {
  internalClusterId: string; // anonymous, deterministic from members
  rootWallet: string;
  memberWallets: string[]; // sorted
  sharedTokens: string[];
  proximityScore: number; // 0-1, higher = funding closer in time
  earliestFunding: number;
  latestFunding: number;
}

// ─── Concentration Abnormality ─────────────────────────────────────────────

export interface WalletVolume {
  wallet: string;
  volumeUsd: number;
}

export interface ConcentrationInput {
  tokenId: string;
  chain: MmChain;
  walletVolumes: WalletVolume[];
  /**
   * Optional HHI threshold override. Spec default: 2500 (antitrust classic).
   * Overridden by `percentiles.hhi.p99` when percentiles are provided.
   */
  hhiThreshold?: number;
  /**
   * Optional top-N share threshold (0-1). Spec default: top3 > 0.6 = signal.
   * Overridden by `percentiles.top3Share.p99` when percentiles are provided.
   */
  topNShareThreshold?: number;
  /**
   * Optional top-N size, default 3.
   */
  topN?: number;
  /**
   * Optional Gini threshold. Overridden by `percentiles.gini.p99`.
   */
  giniThreshold?: number;
  /**
   * Cohort percentiles (Phase 3). When present, thresholds come from the
   * P99 bands of the cohort.
   */
  percentiles?: CohortPercentiles;
}

// ─── Price Asymmetry (secondary, corroborative, spec §7.4) ────────────────

export interface PriceMove {
  timestamp: number; // unix seconds
  priceChangePct: number; // signed percent, e.g. +2.5 or -1.7
  volumeUsd: number;
}

export interface PriceAsymmetryInput {
  tokenId: string;
  chain: MmChain;
  moves: PriceMove[];
  /**
   * Override the 30-day lookback (in seconds). Default: 30 days.
   */
  windowSeconds?: number;
  /**
   * Ratio threshold at which the asymmetry becomes suspicious. Default 3.0.
   * Will be replaced by P99 cohort calibration in a later phase.
   */
  ratioThreshold?: number;
  /**
   * Override "now" for deterministic testing.
   */
  nowSeconds?: number;
}

// ─── Post-Listing Pump (secondary, corroborative, spec §7.5) ──────────────

export interface PostListingPumpInput {
  tokenId: string;
  chain: MmChain;
  listingDate: number; // unix seconds
  priceAtListing: number; // USD
  priceAt7Days: number; // USD
  volumeByWallet: WalletVolume[];
  totalVolumeUsd: number;
  /**
   * Override the 100% pump threshold.
   */
  pumpThreshold?: number;
  /**
   * Override the top-N concentration threshold (default top10 > 0.7).
   */
  concentrationThreshold?: number;
  topN?: number;
}

// ─── Fake Liquidity (core, Phase 9) ───────────────────────────────────────
// Detects market makers running the same capital in circles to inflate
// DexScreener / Birdeye metrics. Unlike Price Asymmetry / Post-Listing
// Pump, this is a CORE detector — no co-occurrence gate required.

export interface LiquidityProvider {
  wallet: string;
  liquidityUsd: number;
}

export interface FakeLiquidityInput {
  tokenAddress: string;
  chain: MmChain;
  totalLiquidityUsd: number;
  dailyVolumeUsd: number;
  volumeByWallet: WalletVolume[];
  liquidityProviders: LiquidityProvider[];
  poolCount: number;
  /**
   * Override the daily-volume / total-liquidity HIGH threshold (default 10).
   */
  volumeRatioHighThreshold?: number;
  /**
   * Override the daily-volume / total-liquidity MEDIUM threshold (default 5).
   */
  volumeRatioMediumThreshold?: number;
  /**
   * Phantom-volume USD minimum — below this the signal never fires
   * (default 500_000 USD).
   */
  phantomVolumeMinUsd?: number;
  /**
   * Microcap liquidity cutoff for POOL_FRAGMENTATION (default 1_000_000 USD).
   */
  microcapLiquidityMax?: number;
}

// ─── Scan Run orchestration ────────────────────────────────────────────────

export interface ScanRunInput {
  subjectType: MmSubjectType;
  subjectId: string;
  chain: MmChain;
  /**
   * The engine runs as a pure function: all detector inputs are passed in,
   * never fetched. Leave a detector input undefined to skip that detector
   * (coverage will reflect the skipped source).
   */
  washTrading?: WashTradingInput;
  cluster?: ClusterInput;
  concentration?: ConcentrationInput;
  /**
   * Core detector (Phase 9). No co-occurrence gate.
   */
  fakeLiquidity?: FakeLiquidityInput;
  /**
   * Secondary, corroborative detectors. Only contribute if at least one core
   * detector emitted a HIGH-severity signal in the same scan (spec §7.4).
   */
  priceAsymmetry?: PriceAsymmetryInput;
  postListingPump?: PostListingPumpInput;
  /**
   * Wallet age in days. Used by hard caps (spec §8.5).
   */
  walletAgeDays?: number;
  /**
   * Cohort key (chain:liquidityTier:ageBucket) for reproducibility. When
   * provided, the runner resolves percentiles via percentileCache and
   * injects them into each core detector (Phase 3). Leave unset to run the
   * detectors against the Phase 2 hard-coded thresholds.
   */
  cohortKey?: string;
  /**
   * Optional pre-fetched cohort percentiles. When present, the runner uses
   * these directly instead of issuing a lookup. Useful for deterministic
   * testing and for callers that batch-fetch percentiles across many scans.
   */
  cohortPercentiles?: CohortPercentiles;
  /**
   * Used for MmScanRun logging — sources that were available to the caller
   * at scan time. Shape matches MmScanRun.dataSources.
   */
  dataSources?: Record<string, unknown>;
  /**
   * Now() override for deterministic tests.
   */
  nowSeconds?: number;
}

export type ConfidenceLevel = "low" | "medium" | "high";
export type CoverageLevel = "low" | "medium" | "high";

export interface ScanRunResult {
  subjectType: MmSubjectType;
  subjectId: string;
  chain: MmChain;
  engineVersion: string;
  behaviorDrivenScore: number;
  rawBehaviorScore: number;
  confidence: ConfidenceLevel;
  coverage: CoverageLevel;
  detectorBreakdown: {
    washTrading: DetectorOutput | null;
    cluster: DetectorOutput | null;
    concentration: DetectorOutput | null;
    fakeLiquidity: DetectorOutput | null;
    priceAsymmetry: DetectorOutput | null;
    postListingPump: DetectorOutput | null;
  };
  signals: DetectorSignal[];
  signalsCount: number;
  capsApplied: string[];
  durationMs: number;
  /**
   * The cohort key that was used for calibration, or null if the scan ran
   * against the Phase 2 hard-coded thresholds.
   */
  cohortKey: string | null;
  /**
   * Snapshot of the percentiles actually consumed by the detectors. Stored
   * on MmScanRun.cohortPercentiles for reproducibility.
   */
  cohortPercentiles: CohortPercentiles | null;
  /**
   * List of co-occurrence decisions applied to secondary detectors. Empty
   * when no secondary detector ran or when all of them were admitted.
   */
  coOccurrence: {
    gatedOut: string[]; // detector types whose score was zeroed out
    admitted: string[]; // detector types that passed the gate
  };
}

// ─── Cohort percentiles (Phase 3) ─────────────────────────────────────────

export interface PercentileBand {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface CohortPercentiles {
  cohortKey: string;
  metrics: Record<string, PercentileBand>;
  sampleSize: number;
  schemaVersion: number;
  /**
   * "stub"   — hard-coded Phase 2 placeholder fallback (no DB hit or parent)
   * "db"     — resolved straight from MmCohortPercentile on this cohortKey
   * "parent" — resolved from a parent cohort (fallback path)
   */
  sourceKind: "stub" | "db" | "parent";
  /**
   * When sourceKind is "parent", this records which key was actually used.
   */
  resolvedFromCohortKey?: string;
}

// ─── Calibrator input (Phase 3) ───────────────────────────────────────────
// A CalibratorInput represents the pre-computed metrics for a single token
// (or wallet, depending on metric) whose values should contribute to the
// cohort's percentile distribution. It also carries the list of wallets
// active on that token so that we can skip it entirely when any wallet is
// already attributed to a Registry entity with high confidence.

export interface CalibratorInput {
  tokenId: string;
  chain: MmChain;
  activeWallets: string[];
  metrics: Partial<Record<CalibratorMetric, number>>;
}

export type CalibratorMetric =
  | "avgVolPerBuyer"
  | "roundTripsPerDay"
  | "mirroredRatio"
  | "clusterSize"
  | "top3Share"
  | "gini"
  | "hhi";

export interface CalibratorResult {
  cohortKey: string;
  metricsUpserted: number;
  sampleSize: number;
  excludedFlaggedCount: number;
  /**
   * The percentile band for each metric that was calibrated — useful for
   * tests and dashboards without re-reading from the DB.
   */
  bands: Record<CalibratorMetric, PercentileBand>;
}
