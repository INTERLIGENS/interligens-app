/**
 * REFLEX V1 — deterministic verdict layer.
 *
 * Apply the V1 decision matrix to a flat list of engine outputs and emit
 * a single ReflexVerdictResult. The matrix never consults an LLM; the
 * function is pure, side-effect-free, and stable across permutations of
 * input order.
 *
 * Decision order (first match wins):
 *
 *  1. STOP — any signal with stopTrigger=true, OR convergence:
 *     recidivist + ≥ STOP_CONVERGENCE_MIN_CRITICAL_DRIVERS CRITICAL
 *     TigerScore drivers + global confidence ≥
 *     STOP_CONVERGENCE_CONFIDENCE_THRESHOLD.
 *  2. WAIT — narrative match with confidence ≥
 *     NARRATIVE_MATCH_WAIT_THRESHOLD, OR a coordination signal of
 *     MODERATE/STRONG severity, OR ≥ WAIT_MIN_CONVERGENT_SIGNALS
 *     weak/moderate signals.
 *  3. VERIFY — a narrative match in a "claim" category
 *     (TRUST_HIJACK / AUTHORITY) is present, with no STOP/WAIT trigger.
 *  4. NO_CRITICAL_SIGNAL — default. Reasons array contains only the
 *     mandatory disclaimer in EN + FR.
 *
 * Output is lint-checked against the forbidden-words list before return.
 * A leak throws ForbiddenWordError — the API route surfaces this as 500
 * + alert rather than serving an unsafe phrase.
 */
import {
  ACTION_WORDING,
  DISCLAIMER_NO_SIGNAL,
  GLOBAL_CONFIDENCE_NO_SIGNAL_THRESHOLD,
  MAX_VERDICT_REASONS,
  NARRATIVE_MATCH_WAIT_THRESHOLD,
  STOP_CONVERGENCE_CONFIDENCE_THRESHOLD,
  STOP_CONVERGENCE_MIN_CRITICAL_DRIVERS,
  VERDICT_WORDING,
  WAIT_MIN_CONVERGENT_SIGNALS,
} from "./constants";
import { computeGlobalConfidence } from "./confidence";
import { assertClean } from "./forbidden-words";
import type {
  ReflexEngineOutput,
  ReflexSignal,
  ReflexSignalSeverity,
  ReflexVerdict,
  ReflexVerdictResult,
} from "./types";
import { reasonForSignal } from "./verdictReasons";

const SEVERITY_RANK: Record<ReflexSignalSeverity, number> = {
  CRITICAL: 4,
  STRONG: 3,
  MODERATE: 2,
  WEAK: 1,
};

const CLAIM_CATEGORIES = new Set(["TRUST_HIJACK", "AUTHORITY"]);

function flattenSignals(engines: readonly ReflexEngineOutput[]): ReflexSignal[] {
  return engines.flatMap((e) => e.signals);
}

function payloadCategory(s: ReflexSignal): string | null {
  const p = s.payload as { category?: unknown } | undefined;
  return typeof p?.category === "string" ? p.category : null;
}

/**
 * Sort signals for reason picking. Order:
 *   stopTrigger desc → severity desc → confidence desc → code asc.
 * The trailing code asc tie-break makes the output stable across
 * permutations of input order.
 */
function sortForReasons(signals: ReflexSignal[]): ReflexSignal[] {
  return [...signals].sort((a, b) => {
    const ast = a.stopTrigger ? 1 : 0;
    const bst = b.stopTrigger ? 1 : 0;
    if (ast !== bst) return bst - ast;
    const as = SEVERITY_RANK[a.severity];
    const bs = SEVERITY_RANK[b.severity];
    if (as !== bs) return bs - as;
    if (a.confidence !== b.confidence) return b.confidence - a.confidence;
    return a.code.localeCompare(b.code);
  });
}

function pickReasons(
  signals: ReflexSignal[],
  locale: "en" | "fr",
  max: number = MAX_VERDICT_REASONS,
): string[] {
  const sorted = sortForReasons(signals);
  const out: string[] = [];
  const seenCodes = new Set<string>();
  for (const s of sorted) {
    if (out.length >= max) break;
    if (seenCodes.has(s.code)) continue;
    const reason = reasonForSignal(s, locale);
    if (!reason) continue;
    seenCodes.add(s.code);
    out.push(reason);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Branch detectors
// ─────────────────────────────────────────────────────────────────────────

function getStopTriggers(signals: ReflexSignal[]): ReflexSignal[] {
  return signals.filter((s) => s.stopTrigger === true);
}

function hasConvergenceSTOP(
  signals: ReflexSignal[],
  globalConfidenceScore: number,
): boolean {
  const isRecidivist = signals.some(
    (s) => s.source === "recidivism" && s.code === "recidivism.recidivist",
  );
  if (!isRecidivist) return false;
  const criticalTigerDrivers = signals.filter(
    (s) => s.source === "tigerscore" && s.severity === "CRITICAL",
  ).length;
  if (criticalTigerDrivers < STOP_CONVERGENCE_MIN_CRITICAL_DRIVERS) return false;
  return globalConfidenceScore >= STOP_CONVERGENCE_CONFIDENCE_THRESHOLD;
}

function hasNarrativeWAIT(signals: ReflexSignal[]): boolean {
  return signals.some(
    (s) =>
      s.source === "narrative" &&
      s.confidence >= NARRATIVE_MATCH_WAIT_THRESHOLD,
  );
}

function hasCoordinationWAIT(signals: ReflexSignal[]): boolean {
  return signals.some(
    (s) =>
      s.source === "coordination" &&
      (s.severity === "MODERATE" || s.severity === "STRONG"),
  );
}

function hasConvergenceWAIT(signals: ReflexSignal[]): boolean {
  const weakOrModerate = signals.filter(
    (s) => s.severity === "WEAK" || s.severity === "MODERATE",
  );
  return weakOrModerate.length >= WAIT_MIN_CONVERGENT_SIGNALS;
}

function hasUnverifiableClaim(signals: ReflexSignal[]): boolean {
  return signals.some(
    (s) => s.source === "narrative" && CLAIM_CATEGORIES.has(payloadCategory(s) ?? ""),
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

interface DecisionDraft {
  verdict: ReflexVerdict;
  reasonsSource: ReflexSignal[];
}

function decideBranch(
  signals: ReflexSignal[],
  globalConfidenceScore: number,
): DecisionDraft {
  // 1. STOP
  const stopTriggers = getStopTriggers(signals);
  if (stopTriggers.length > 0) {
    return { verdict: "STOP", reasonsSource: stopTriggers };
  }
  if (hasConvergenceSTOP(signals, globalConfidenceScore)) {
    return {
      verdict: "STOP",
      reasonsSource: signals.filter(
        (s) =>
          (s.source === "recidivism" && s.code === "recidivism.recidivist") ||
          (s.source === "tigerscore" && s.severity === "CRITICAL"),
      ),
    };
  }

  // 2. WAIT
  const narrativeWait = hasNarrativeWAIT(signals);
  const coordinationWait = hasCoordinationWAIT(signals);
  const convergenceWait = hasConvergenceWAIT(signals);
  if (narrativeWait || coordinationWait || convergenceWait) {
    const reasonsSource = signals.filter((s) => {
      if (
        narrativeWait &&
        s.source === "narrative" &&
        s.confidence >= NARRATIVE_MATCH_WAIT_THRESHOLD
      )
        return true;
      if (
        coordinationWait &&
        s.source === "coordination" &&
        (s.severity === "MODERATE" || s.severity === "STRONG")
      )
        return true;
      if (
        convergenceWait &&
        (s.severity === "WEAK" || s.severity === "MODERATE")
      )
        return true;
      return false;
    });
    return { verdict: "WAIT", reasonsSource };
  }

  // 3. VERIFY
  if (hasUnverifiableClaim(signals)) {
    return {
      verdict: "VERIFY",
      reasonsSource: signals.filter(
        (s) =>
          s.source === "narrative" &&
          CLAIM_CATEGORIES.has(payloadCategory(s) ?? ""),
      ),
    };
  }

  // 4. NO_CRITICAL_SIGNAL (default)
  return { verdict: "NO_CRITICAL_SIGNAL", reasonsSource: [] };
}

/**
 * Apply the V1 decision matrix. Pure function — given the same engine
 * outputs, returns the same ReflexVerdictResult.
 */
export function decide(
  engines: readonly ReflexEngineOutput[],
): ReflexVerdictResult {
  const signals = flattenSignals(engines);
  const { score: confidenceScore, label: confidence } =
    computeGlobalConfidence(engines);

  const { verdict, reasonsSource } = decideBranch(signals, confidenceScore);

  const verdictReasonEn =
    verdict === "NO_CRITICAL_SIGNAL"
      ? [DISCLAIMER_NO_SIGNAL.en]
      : pickReasons(reasonsSource, "en");
  const verdictReasonFr =
    verdict === "NO_CRITICAL_SIGNAL"
      ? [DISCLAIMER_NO_SIGNAL.fr]
      : pickReasons(reasonsSource, "fr");

  const actionEn = ACTION_WORDING[verdict].en;
  const actionFr = ACTION_WORDING[verdict].fr;

  // Final guard: every user-facing string must pass the forbidden-words
  // lint. A leak throws ForbiddenWordError, which the route handler
  // catches and surfaces as 500 rather than serving an unsafe verdict.
  assertClean(
    [
      VERDICT_WORDING[verdict].en,
      VERDICT_WORDING[verdict].fr,
      actionEn,
      actionFr,
      ...verdictReasonEn,
      ...verdictReasonFr,
    ],
    `verdict.${verdict}`,
  );

  return {
    verdict,
    verdictReasonEn,
    verdictReasonFr,
    actionEn,
    actionFr,
    confidence,
    confidenceScore,
  };
}
