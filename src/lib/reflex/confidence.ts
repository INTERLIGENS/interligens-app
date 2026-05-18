/**
 * REFLEX V1 — global confidence.
 *
 * Global confidence reflects the quality of the signals we found, NOT the
 * coverage of engines that ran clean. An engine that ran and produced no
 * signals (knownBad with no hit, casefileMatch with no exact match, etc.)
 * is INFORMATIVE about absence-of-risk but does not contribute to the
 * "how sure are we about the signals we found" question — so it is
 * skipped from the average.
 *
 * Pre-Commit-8a, ran-clean engines contributed a flat 0.5. That diluted
 * the global confidence below the STOP_CONVERGENCE_CONFIDENCE_THRESHOLD
 * (0.7) even when the firing engines reported max-confidence signals,
 * because the average dragged down toward 0.5. Calibration discovered
 * the bug: STOP-convergence became mathematically unreachable in
 * production (5+ engines, max average ≈ 0.667).
 *
 * Per-engine contribution rule (post-Commit-8a):
 *   - !ran                    → skipped entirely
 *   - ran && signals.length=0 → skipped (clean engine, no claim to be
 *                                        "confident" about — absence-of-
 *                                        signal informs the verdict layer
 *                                        directly via the branch logic, not
 *                                        through confidence)
 *   - ran && signals.length>0 → max(signal.confidence)
 *
 * Edge case — every engine ran clean: contributions is empty. We return
 * { score: 0, label: "LOW" }. The verdict layer's NO_CRITICAL_SIGNAL
 * branch handles a LOW score by surfacing the disclaimer with the
 * caveat that coverage was the only thing we could vouch for.
 *
 * Discretization into HIGH/MEDIUM/LOW uses the thresholds in constants.ts
 * (GLOBAL_CONFIDENCE_HIGH_THRESHOLD, GLOBAL_CONFIDENCE_MEDIUM_THRESHOLD).
 * The final score is rounded to 3 decimals so JS float non-associativity
 * doesn't leak determinism across permutations of input order.
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

function engineContribution(e: ReflexEngineOutput): number | null {
  if (!e.ran) return null;
  // Clean engines (ran with no signals) contribute nothing — see file
  // header for the rationale. Pre-8a this returned 0.5, which made
  // STOP-convergence unreachable.
  if (e.signals.length === 0) return null;
  return Math.max(...e.signals.map((s) => s.confidence));
}

export function computeGlobalConfidence(
  engines: readonly ReflexEngineOutput[],
): GlobalConfidence {
  const contributions = engines
    .map(engineContribution)
    .filter((x): x is number => x !== null);

  if (contributions.length === 0) return { score: 0, label: "LOW" };

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
