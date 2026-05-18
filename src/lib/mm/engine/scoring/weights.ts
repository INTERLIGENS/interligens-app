// ─── Pattern Engine weights (spec §8.4) ────────────────────────────────────
// Max point contribution per detector to the behaviorDrivenScore.
// The Pattern Engine is architecturally capped at 90 — reaching 100 requires
// a Registry contribution (spec §8.1).

import type { DetectorType } from "../types";

export const DETECTOR_MAX_POINTS: Record<DetectorType, number> = {
  WASH_TRADING: 30,
  CLUSTER_COORDINATION: 25,
  CONCENTRATION_ABNORMALITY: 20,
  FAKE_LIQUIDITY: 20, // core, Phase 9
  PRICE_ASYMMETRY: 8, // corroborative, Phase 4
  POST_LISTING_PUMP: 7, // corroborative, Phase 4
  KNOWN_ENTITY_FLOOR: 0, // adapter-level, not a detector
};

export const PATTERN_ENGINE_HARD_CEILING = 90;

// ─── Per-detector max contributions (convenience re-exports) ───────────────
// Phase 9 raises the theoretical sum to 110 (30+25+20+20+8+7) but the
// PATTERN_ENGINE_HARD_CEILING stays at 90 — behaviorDrivenScore.ts clamps
// the aggregate. Distribution across detectors is preserved (no per-detector
// normalisation) so the evidence trail remains interpretable.

export const WASH_TRADING_MAX = DETECTOR_MAX_POINTS.WASH_TRADING;
export const CLUSTER_MAX = DETECTOR_MAX_POINTS.CLUSTER_COORDINATION;
export const CONCENTRATION_MAX = DETECTOR_MAX_POINTS.CONCENTRATION_ABNORMALITY;
export const FAKE_LIQUIDITY_MAX = DETECTOR_MAX_POINTS.FAKE_LIQUIDITY;
export const PRICE_ASYMMETRY_MAX = DETECTOR_MAX_POINTS.PRICE_ASYMMETRY;
export const POST_LISTING_PUMP_MAX = DETECTOR_MAX_POINTS.POST_LISTING_PUMP;

// Sanity check: the per-detector sum now exceeds the ceiling on purpose;
// assert the ceiling invariant holds at import time.
/* c8 ignore start */
{
  const sum =
    WASH_TRADING_MAX +
    CLUSTER_MAX +
    CONCENTRATION_MAX +
    FAKE_LIQUIDITY_MAX +
    PRICE_ASYMMETRY_MAX +
    POST_LISTING_PUMP_MAX;
  if (sum < PATTERN_ENGINE_HARD_CEILING) {
    throw new Error(
      `weights.ts invariant broken: sum=${sum} < ceiling=${PATTERN_ENGINE_HARD_CEILING}`,
    );
  }
}
/* c8 ignore stop */

// ─── Wash Trading sub-signal weights ──────────────────────────────────────
// Sum must stay ≤ DETECTOR_MAX_POINTS.WASH_TRADING (30). Spec §7.1.

export const WASH_TRADING_SUBSIGNAL_POINTS = {
  CONCENTRATION: 10,
  ROUND_TRIP: 12,
  MIRRORED: 8,
} as const;

// ─── Cluster sub-signal weights ────────────────────────────────────────────
// Sum ≤ DETECTOR_MAX_POINTS.CLUSTER_COORDINATION (25). Spec §7.2.

export const CLUSTER_SUBSIGNAL_POINTS = {
  CLUSTER_DETECTED: 12,
  TEMPORAL_TIGHT: 9,
  MULTI_TOKEN: 4,
} as const;

// ─── Concentration sub-signal weights ──────────────────────────────────────
// Sum ≤ DETECTOR_MAX_POINTS.CONCENTRATION_ABNORMALITY (20). Spec §7.3.

export const CONCENTRATION_SUBSIGNAL_POINTS = {
  TOPN_DOMINATES: 8,
  GINI_HIGH: 6,
  HHI_ABOVE_2500: 6,
} as const;

// ─── Fake Liquidity sub-signal weights (Phase 9) ──────────────────────────
// Sum ≤ DETECTOR_MAX_POINTS.FAKE_LIQUIDITY (20).

export const FAKE_LIQUIDITY_SUBSIGNAL_POINTS = {
  VOLUME_LIQUIDITY_MISMATCH: 8,
  LIQUIDITY_CONCENTRATION: 5,
  PHANTOM_VOLUME: 5,
  POOL_FRAGMENTATION: 2,
} as const;

export const ENGINE_VERSION = "0.4.0-engine";
export const DETECTORS_VERSION: Record<string, string> = {
  washTrading: "1.0.0",
  cluster: "1.0.0",
  concentration: "1.0.0",
  fakeLiquidity: "1.0.0",
  priceAsymmetry: "1.0.0",
  postListingPump: "1.0.0",
};
