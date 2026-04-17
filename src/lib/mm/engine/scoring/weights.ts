// ─── Pattern Engine weights (spec §8.4) ────────────────────────────────────
// Max point contribution per detector to the behaviorDrivenScore.
// The Pattern Engine is architecturally capped at 90 — reaching 100 requires
// a Registry contribution (spec §8.1).

import type { DetectorType } from "../types";

export const DETECTOR_MAX_POINTS: Record<DetectorType, number> = {
  WASH_TRADING: 30,
  CLUSTER_COORDINATION: 25,
  CONCENTRATION_ABNORMALITY: 20,
  PRICE_ASYMMETRY: 8, // corroborative, Phase 4
  POST_LISTING_PUMP: 7, // corroborative, Phase 4
  KNOWN_ENTITY_FLOOR: 0, // adapter-level, not a detector
};

export const PATTERN_ENGINE_HARD_CEILING = 90;

// ─── Per-detector max contributions (convenience re-exports) ───────────────
// Total of the 5 detectors (30+25+20+8+7) equals 90 — exactly matches the
// PATTERN_ENGINE_HARD_CEILING as required by spec §8.4.

export const WASH_TRADING_MAX = DETECTOR_MAX_POINTS.WASH_TRADING;
export const CLUSTER_MAX = DETECTOR_MAX_POINTS.CLUSTER_COORDINATION;
export const CONCENTRATION_MAX = DETECTOR_MAX_POINTS.CONCENTRATION_ABNORMALITY;
export const PRICE_ASYMMETRY_MAX = DETECTOR_MAX_POINTS.PRICE_ASYMMETRY;
export const POST_LISTING_PUMP_MAX = DETECTOR_MAX_POINTS.POST_LISTING_PUMP;

// Sanity check that the spec ceiling invariant holds at import time.
/* c8 ignore start */
{
  const sum =
    WASH_TRADING_MAX +
    CLUSTER_MAX +
    CONCENTRATION_MAX +
    PRICE_ASYMMETRY_MAX +
    POST_LISTING_PUMP_MAX;
  if (sum !== PATTERN_ENGINE_HARD_CEILING) {
    throw new Error(
      `weights.ts invariant broken: sum=${sum} != ceiling=${PATTERN_ENGINE_HARD_CEILING}`,
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

export const ENGINE_VERSION = "0.3.0-engine";
export const DETECTORS_VERSION: Record<string, string> = {
  washTrading: "1.0.0",
  cluster: "1.0.0",
  concentration: "1.0.0",
  priceAsymmetry: "1.0.0",
  postListingPump: "1.0.0",
};
