// ─── Confidence tier (spec §8.1) ──────────────────────────────────────────
// Pure function. No I/O.
//
// Registry contribution is handled at the adapter layer (Phase 5). For the
// Pattern Engine alone, confidence is driven by the number of core detectors
// that emitted at least one HIGH-severity signal:
//   • 3+ core detectors with HIGH signal → high
//   • 2   core detectors with HIGH signal → medium
//   • 1   or only MEDIUM/LOW              → low
//
// A detector that was not run (null output) counts as 0.

import type { ConfidenceLevel, DetectorOutput, DetectorSignal } from "../types";

export function hasHighSignal(output: DetectorOutput | null): boolean {
  if (!output) return false;
  return output.signals.some((s: DetectorSignal) => s.severity === "HIGH");
}

export function hasAnySignal(output: DetectorOutput | null): boolean {
  if (!output) return false;
  return output.signals.length > 0;
}

export function computeConfidence(
  outputs: Array<DetectorOutput | null>,
): ConfidenceLevel {
  const highCount = outputs.filter(hasHighSignal).length;
  const anyCount = outputs.filter(hasAnySignal).length;
  if (highCount >= 3) return "high";
  if (highCount >= 2) return "medium";
  if (anyCount >= 1) return "low";
  return "low";
}

export function countCoreWithHigh(
  outputs: Array<DetectorOutput | null>,
): number {
  return outputs.filter(hasHighSignal).length;
}

export function countCoreWithAnySignal(
  outputs: Array<DetectorOutput | null>,
): number {
  return outputs.filter(hasAnySignal).length;
}
