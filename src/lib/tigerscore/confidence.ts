// ─── TigerScore confidence level ──────────────────────────────────────────
// Pure function. Maps the raw engine drivers + data coverage into a
// "Low" | "Medium" | "High" tier for the retail-facing UI.
//
// Rules (hardening v1):
//   • RPC down / missing data → Low, always.
//   • Any confirmed "critical" driver + ≥ 1 supporting driver → High.
//   • ≥ 2 drivers with severity ≥ "med" → High.
//   • Exactly 1 "high|critical" driver OR 2+ "med" drivers → Medium.
//   • No drivers, or only "low" severity → Low.
//
// These tiers are intentionally coarse — they describe *confidence in the
// conclusion*, not confidence in the numeric score (that's `score` itself).

import type { TigerDriver, TigerResult } from "@/lib/tigerscore/engine";

export type ConfidenceLevel = "Low" | "Medium" | "High";

export interface ConfidenceInput {
  drivers: TigerDriver[];
  /**
   * Data quality flags. When any is true, cap the level at "Low".
   */
  rpcDown?: boolean;
  rpcFallbackUsed?: boolean;
  /**
   * Optional score. Used purely to distinguish high/medium when drivers
   * counts are on the boundary.
   */
  score?: number;
}

const SEVERITY_RANK: Record<TigerDriver["severity"], number> = {
  low: 1,
  med: 2,
  high: 3,
  critical: 4,
};

export function computeConfidenceLevel(input: ConfidenceInput): ConfidenceLevel {
  const { drivers, rpcDown, rpcFallbackUsed } = input;

  if (rpcDown) return "Low";

  if (drivers.length === 0) return "Low";

  const counts = {
    low: 0,
    med: 0,
    high: 0,
    critical: 0,
  };
  for (const d of drivers) counts[d.severity] += 1;

  const hasCritical = counts.critical >= 1;
  const supporting = counts.critical + counts.high + counts.med - 1;

  if (hasCritical && supporting >= 1) return "High";
  if (counts.high + counts.critical >= 2) return "High";
  if (counts.med >= 2 && !rpcFallbackUsed) return "High";

  if (counts.critical === 1 || counts.high === 1) return "Medium";
  if (counts.med >= 2) return "Medium";
  if (counts.med === 1) return rpcFallbackUsed ? "Low" : "Medium";

  return "Low";
}

/**
 * Convenience: compute confidence directly from a full TigerResult. Uses the
 * drivers and (optionally) a supplied data-quality context to decide.
 */
export function confidenceFromResult(
  result: Pick<TigerResult, "drivers" | "score" | "confidence">,
  ctx?: { rpcDown?: boolean; rpcFallbackUsed?: boolean },
): ConfidenceLevel {
  return computeConfidenceLevel({
    drivers: result.drivers,
    score: result.score,
    rpcDown: ctx?.rpcDown,
    rpcFallbackUsed: ctx?.rpcFallbackUsed,
  });
}

export const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
};

export function isHigherConfidence(
  a: ConfidenceLevel,
  b: ConfidenceLevel,
): boolean {
  return CONFIDENCE_RANK[a] > CONFIDENCE_RANK[b];
}

export { SEVERITY_RANK };
