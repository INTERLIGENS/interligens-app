// ─── behaviorDrivenScore aggregation (spec §8.5, §8.6) ────────────────────
// Pure function. No I/O.
//
// Combines detector contributions and applies anti-false-positive caps.
//
// Order of operations (matters!):
//   1. Raw sum = washTrading.score + cluster.score + concentration.score
//   2. Engine ceiling: min(raw, 90)
//   3. Anti-FP caps (take the lowest):
//        • < 2 core detectors with HIGH signal → cap at 39
//        • walletAgeDays < 7                   → cap at 59
//
// The adapter layer (Phase 5) applies further confidence/coverage caps
// before consolidation with the Registry.

import type { ConfidenceLevel, CoverageLevel, DetectorOutput } from "../types";
import { PATTERN_ENGINE_HARD_CEILING } from "./weights";
import { countCoreWithHigh } from "./confidence";

export interface BehaviorScoreInput {
  detectors: {
    washTrading: DetectorOutput | null;
    cluster: DetectorOutput | null;
    concentration: DetectorOutput | null;
    /**
     * Core detector (Phase 9). Contributes unconditionally — no
     * co-occurrence gate.
     */
    fakeLiquidity?: DetectorOutput | null;
    /**
     * Secondary corroborative detectors. Their `score` is always 0 on the
     * output object — the real contribution lives on
     * `evidence.scoreIfCoOccurrent` and is admitted here only when a core
     * detector emitted a HIGH signal.
     */
    priceAsymmetry?: DetectorOutput | null;
    postListingPump?: DetectorOutput | null;
  };
  walletAgeDays?: number;
  confidence?: ConfidenceLevel;
  coverage?: CoverageLevel;
}

export interface BehaviorScoreOutput {
  rawScore: number;
  score: number;
  capsApplied: string[];
  coOccurrence: {
    gatedOut: string[];
    admitted: string[];
  };
}

function secondaryContribution(d: DetectorOutput | null | undefined): number {
  if (!d) return 0;
  const fromEvidence = (d.evidence as { scoreIfCoOccurrent?: unknown })
    ?.scoreIfCoOccurrent;
  return typeof fromEvidence === "number" && Number.isFinite(fromEvidence)
    ? Math.max(0, fromEvidence)
    : 0;
}

// Cap values as per spec §8.5 — Pattern-Engine-only caps (the adapter layer
// applies the remaining Registry-aware caps in Phase 5).
const CAP_LESS_THAN_2_CORE = 39;
const CAP_WALLET_LT_7D = 59;
const CAP_COVERAGE_LOW = 49;
const CAP_CONFIDENCE_LOW_NO_REG = 44;

export function computeBehaviorDrivenScore(
  input: BehaviorScoreInput,
): BehaviorScoreOutput {
  const {
    washTrading,
    cluster,
    concentration,
    fakeLiquidity,
    priceAsymmetry,
    postListingPump,
  } = input.detectors;

  const coreSum =
    (washTrading?.score ?? 0) +
    (cluster?.score ?? 0) +
    (concentration?.score ?? 0) +
    (fakeLiquidity?.score ?? 0);

  const detectorList: Array<DetectorOutput | null> = [
    washTrading ?? null,
    cluster ?? null,
    concentration ?? null,
    fakeLiquidity ?? null,
  ];
  const coreHigh = countCoreWithHigh(detectorList);

  // Secondary detectors only contribute when ≥ 1 core detector emitted HIGH.
  const gatedOut: string[] = [];
  const admitted: string[] = [];
  let secondarySum = 0;

  const admit = (name: string, d: DetectorOutput | null | undefined) => {
    if (!d) return;
    const contrib = secondaryContribution(d);
    if (contrib === 0) return;
    if (coreHigh >= 1) {
      secondarySum += contrib;
      admitted.push(name);
    } else {
      gatedOut.push(name);
    }
  };
  admit("PRICE_ASYMMETRY", priceAsymmetry);
  admit("POST_LISTING_PUMP", postListingPump);

  const rawScore = coreSum + secondarySum;
  let score = Math.min(rawScore, PATTERN_ENGINE_HARD_CEILING);
  const capsApplied: string[] = [];

  if (coreHigh < 2) {
    if (score > CAP_LESS_THAN_2_CORE) {
      score = CAP_LESS_THAN_2_CORE;
      capsApplied.push(`cap_less_than_2_core:${CAP_LESS_THAN_2_CORE}`);
    }
  }

  if (typeof input.walletAgeDays === "number" && input.walletAgeDays < 7) {
    if (score > CAP_WALLET_LT_7D) {
      score = CAP_WALLET_LT_7D;
      capsApplied.push(`cap_wallet_age_lt_7d:${CAP_WALLET_LT_7D}`);
    }
  }

  if (input.coverage === "low") {
    if (score > CAP_COVERAGE_LOW) {
      score = CAP_COVERAGE_LOW;
      capsApplied.push(`cap_coverage_low:${CAP_COVERAGE_LOW}`);
    }
  }

  if (input.confidence === "low") {
    if (score > CAP_CONFIDENCE_LOW_NO_REG) {
      score = CAP_CONFIDENCE_LOW_NO_REG;
      capsApplied.push(`cap_confidence_low_no_registry:${CAP_CONFIDENCE_LOW_NO_REG}`);
    }
  }

  if (score === PATTERN_ENGINE_HARD_CEILING && rawScore > PATTERN_ENGINE_HARD_CEILING) {
    capsApplied.push(`engine_hard_ceiling:${PATTERN_ENGINE_HARD_CEILING}`);
  }

  return {
    rawScore,
    score,
    capsApplied,
    coOccurrence: { gatedOut, admitted },
  };
}

export const ENGINE_CAPS = {
  CAP_LESS_THAN_2_CORE,
  CAP_WALLET_LT_7D,
  CAP_COVERAGE_LOW,
  CAP_CONFIDENCE_LOW_NO_REG,
  PATTERN_ENGINE_HARD_CEILING,
} as const;
