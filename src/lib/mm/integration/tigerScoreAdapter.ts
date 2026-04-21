// ─── MM cap adapter for TigerScore (spec §11.2, §11.3) ───────────────────
// Pure function. Takes the current TigerScore and the latest
// MmRiskAssessment; returns the capped score + an audit trail.
//
// The whole adapter is a NO-OP when the feature flag is off. When on, caps
// follow the rules from spec §11.2:
//
//   displayScore ≥ 90 AND confidence=high AND coverage≠low → cap to 30
//   displayScore 70-89 AND confidence=high                → cap to 50
//   displayScore 40-69 AND confidence∈{medium,high}       → penalty -10
//   displayScore 20-39                                     → info only
//   coverage=low                                           → info only, never cap
//   confidence=low                                         → info only, never cap
//   freshness=stale                                        → attenuate cap 50% + disclaimer
//
// The adapter also respects admin overrides (see override.ts). When an
// override matches, the cap is converted to an INFO-only signal.

import type { MmRiskAssessment } from "../adapter/types";
import {
  buildMmEvidence,
  type MmTigerScoreEvidence,
} from "./evidence";
import { isMmIntegrationEnabled, type EnvBag } from "./featureFlag";

export interface MmCapResult {
  adjustedScore: number;
  capApplied: boolean;
  capReason: string | null;
  evidence: MmTigerScoreEvidence | null;
  /**
   * Additional disclaimer the UI should surface next to the TigerScore when
   * the cap was attenuated (e.g. because the MM analysis is stale).
   */
  disclaimer: string | null;
}

export interface ApplyMmCapOptions {
  /**
   * Allow callers to pass a pre-computed override decision (e.g. from the
   * admin override list). When true, the cap is converted to an INFO signal.
   */
  overridden?: boolean;
  /**
   * Env bag used to evaluate the feature flag. Lets tests drive the flag
   * without mutating process.env.
   */
  env?: EnvBag;
  /**
   * Base URL for evidence links (defaults to ""). Not used for the cap math.
   */
  evidenceBaseUrl?: string;
}

const FREEZE_REASONS = {
  FLAG_OFF: "flag_off",
  NO_DATA: "no_mm_data",
  COVERAGE_LOW: "coverage_low_info_only",
  CONFIDENCE_LOW: "confidence_low_info_only",
  OVERRIDDEN: "admin_override",
} as const;

export function applyMmCapToTigerScore(
  tigerScore: number,
  mm: MmRiskAssessment,
  opts: ApplyMmCapOptions = {},
): MmCapResult {
  const safeScore = clamp(tigerScore);

  // Feature flag is the absolute kill switch.
  if (!isMmIntegrationEnabled(opts.env)) {
    return {
      adjustedScore: safeScore,
      capApplied: false,
      capReason: FREEZE_REASONS.FLAG_OFF,
      evidence: null,
      disclaimer: null,
    };
  }

  const displayScore = mm.overall.displayScore;
  const confidence = mm.engine.confidence;
  const coverage = mm.engine.coverage;
  const staleness = mm.overall.freshness.staleness;

  // Admin override → keep score untouched but emit info evidence.
  if (opts.overridden) {
    return buildInfoOnly(
      tigerScore,
      mm,
      FREEZE_REASONS.OVERRIDDEN,
      opts.evidenceBaseUrl,
    );
  }

  // Low coverage or low confidence → no cap ever (spec §11.2 guard).
  if (coverage === "low") {
    return buildInfoOnly(
      tigerScore,
      mm,
      FREEZE_REASONS.COVERAGE_LOW,
      opts.evidenceBaseUrl,
    );
  }
  if (confidence === "low") {
    return buildInfoOnly(
      tigerScore,
      mm,
      FREEZE_REASONS.CONFIDENCE_LOW,
      opts.evidenceBaseUrl,
    );
  }

  let cap: number | null = null;
  let penalty = 0;
  let capReason: string | null = null;

  if (displayScore >= 90 && confidence === "high") {
    cap = 30;
    capReason = "mm_convicted_or_severe_pattern:cap_30";
  } else if (displayScore >= 70 && confidence === "high") {
    cap = 50;
    capReason = "mm_high_risk:cap_50";
  } else if (displayScore >= 40) {
    penalty = 10;
    capReason = "mm_medium_risk:penalty_minus_10";
  } else if (displayScore >= 20) {
    return buildInfoOnly(tigerScore, mm, "mm_low_signal_info_only", opts.evidenceBaseUrl);
  } else {
    return buildInfoOnly(tigerScore, mm, "mm_no_signal_info_only", opts.evidenceBaseUrl);
  }

  // Stale attenuation (50%) + disclaimer.
  let attenuatedNote: string | null = null;
  if (staleness === "stale") {
    if (cap !== null) {
      // Shift the cap halfway back toward the current TigerScore.
      cap = Math.round(cap + (safeScore - cap) * 0.5);
    } else if (penalty > 0) {
      penalty = Math.round(penalty * 0.5);
    }
    attenuatedNote =
      "Cap MM atténué de 50% — analyse MM datant de plus de 24h.";
    capReason = capReason ? `${capReason}+stale_attenuated` : "stale_attenuated";
  }

  const adjustedScore =
    cap !== null
      ? Math.min(safeScore, cap)
      : Math.max(0, safeScore - penalty);

  const capApplied = adjustedScore < safeScore;
  const scoreImpact = adjustedScore - safeScore; // negative or 0

  if (!capApplied) {
    // Score is already below the cap — no real effect, return an INFO signal.
    return buildInfoOnly(tigerScore, mm, "already_below_cap", opts.evidenceBaseUrl);
  }

  const evidence = buildMmEvidence({
    assessment: mm,
    scoreImpact,
    baseUrl: opts.evidenceBaseUrl,
  });

  return {
    adjustedScore,
    capApplied: true,
    capReason,
    evidence,
    disclaimer: attenuatedNote,
  };
}

function buildInfoOnly(
  tigerScore: number,
  mm: MmRiskAssessment,
  reason: string,
  baseUrl: string | undefined,
): MmCapResult {
  const evidence = buildMmEvidence({
    assessment: mm,
    scoreImpact: 0,
    baseUrl,
  });
  // Force INFO priority for no-cap paths.
  evidence.priority = "INFO";
  return {
    adjustedScore: clamp(tigerScore),
    capApplied: false,
    capReason: reason,
    evidence,
    disclaimer: null,
  };
}

function clamp(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 100) return 100;
  return Math.round(x);
}

export const MM_CAP_REASONS = FREEZE_REASONS;
