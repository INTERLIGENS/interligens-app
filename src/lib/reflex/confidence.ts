/**
 * REFLEX V1 — global confidence.
 *
 * For each engine that RAN, the confidence "contribution" is:
 *   - max(signal.confidence) if any signals fired
 *   - ENGINE_CLEAN_DEFAULT (0.5) otherwise (engine ran-clean — useful
 *     coverage but not full confidence)
 *   - skipped entirely if ran=false (engine didn't apply or errored)
 *
 * The final score is the unweighted mean across contributing engines.
 * V1 chooses simplicity over per-engine weighting; the shadow phase
 * will tell us whether tuning is needed.
 *
 * Discretization into HIGH/MEDIUM/LOW uses the thresholds in
 * constants.ts (GLOBAL_CONFIDENCE_HIGH_THRESHOLD,
 * GLOBAL_CONFIDENCE_MEDIUM_THRESHOLD).
 */
import {
  GLOBAL_CONFIDENCE_HIGH_THRESHOLD,
  GLOBAL_CONFIDENCE_MEDIUM_THRESHOLD,
} from "./constants";
import type {
  ReflexConfidence,
  ReflexEngineOutput,
} from "./types";

export interface GlobalConfidence {
  score: number;
  label: ReflexConfidence;
}

const ENGINE_CLEAN_DEFAULT = 0.5;

function engineContribution(e: ReflexEngineOutput): number | null {
  if (!e.ran) return null;
  if (e.signals.length === 0) return ENGINE_CLEAN_DEFAULT;
  return Math.max(...e.signals.map((s) => s.confidence));
}

export function computeGlobalConfidence(
  engines: readonly ReflexEngineOutput[],
): GlobalConfidence {
  const contributions = engines
    .map(engineContribution)
    .filter((x): x is number => x !== null);

  if (contributions.length === 0) return { score: 0, label: "LOW" };

  // Round to 3 decimal places: removes floating-point variance across
  // permutations of input order (sum-of-floats isn't associative), so the
  // verdict layer's confidenceScore is bit-stable. Three decimals are
  // finer than any threshold band, so discretization is unaffected.
  const raw =
    contributions.reduce((a, b) => a + b, 0) / contributions.length;
  const score = Math.round(raw * 1000) / 1000;

  const label: ReflexConfidence =
    score >= GLOBAL_CONFIDENCE_HIGH_THRESHOLD
      ? "HIGH"
      : score >= GLOBAL_CONFIDENCE_MEDIUM_THRESHOLD
        ? "MEDIUM"
        : "LOW";

  return { score, label };
}
