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
import type { MeasurementState } from "@/lib/publication/absenceVocabulary";
import type {
  ReflexConfidence,
  ReflexEngineOutput,
} from "./types";

export interface GlobalConfidence {
  /** `null` quand rien n'a été mesuré. Jamais `0` dans ce cas. */
  score: number | null;
  label: ReflexConfidence | null;
  /** Pourquoi le score vaut ce qu'il vaut. Toujours présent. */
  state: MeasurementState;
}

// ─── BUILD 11 — DEUX `return null` QUI DISAIENT DEUX CHOSES OPPOSÉES ─────
//
// L'ancienne fonction rendait `null` dans deux cas contraires :
//
//     if (!e.ran) return null;                 // le provider est tombé
//     if (e.signals.length === 0) return null; // le moteur a tourné, rien trouvé
//
// Le premier est une ABSENCE DE MESURE, le second un CONSTAT. Fondus dans la
// même sortie, ils produisaient la même confiance — et huit pannes rendaient
// exactement ce que rendaient huit constats propres.
//
// La contribution au SCORE reste la même dans les deux cas, et c'est correct :
// un moteur qui n'a rien trouvé n'a rien dont on puisse être « confiant ».
// Ce qui change, c'est qu'on cesse de perdre POURQUOI il ne contribue pas.
type Contribution =
  | { kind: "value"; value: number }
  /** Le moteur n'a pas tourné. `state` dit s'il est tombé ou n'a pas été sollicité. */
  | { kind: "unmeasured"; state: MeasurementState }
  /** Le moteur a tourné et n'a rien trouvé. Il n'y a rien à noter, et c'est un fait. */
  | { kind: "clean" };

function engineContribution(e: ReflexEngineOutput): Contribution {
  if (!e.ran) {
    // `error` posé par l'adaptateur = tentative échouée. Absent = jamais
    // sollicité, faute d'entrée. Deux situations, deux états.
    return { kind: "unmeasured", state: e.error ? "FAILURE" : "NOT_MEASURED" };
  }
  if (e.signals.length === 0) return { kind: "clean" };
  return { kind: "value", value: Math.max(...e.signals.map((s) => s.confidence)) };
}

/**
 * L'état de mesure d'un ensemble de moteurs non mesurés.
 *
 * Tous tombés → FAILURE. Tous non sollicités → NOT_MEASURED. Un mélange ne se
 * résume à aucun des deux : UNKNOWN, et c'est le dernier recours, pas le
 * premier — on ne l'emploie que faute de pouvoir dire mieux.
 */
function stateOf(states: readonly MeasurementState[]): MeasurementState {
  if (states.length === 0) return "NOT_MEASURED";
  const uniques = new Set(states);
  return uniques.size === 1 ? [...uniques][0] : "UNKNOWN";
}

export function computeGlobalConfidence(
  engines: readonly ReflexEngineOutput[],
): GlobalConfidence {
  const parts = engines.map(engineContribution);
  const valeurs = parts.filter((p): p is { kind: "value"; value: number } => p.kind === "value");
  const propres = parts.filter((p) => p.kind === "clean").length;
  const nonMesures = parts.filter(
    (p): p is { kind: "unmeasured"; state: MeasurementState } => p.kind === "unmeasured",
  );

  // ── RIEN N'A ÉTÉ MESURÉ ────────────────────────────────────────────────
  //
  // `score: 0` disait ici « confiance nulle », ce qui est une MESURE. Or il
  // n'y en a pas eu. Le nombre devient `null` et l'état dit pourquoi : la
  // dégradation voyage à côté de la valeur, jamais dedans.
  if (valeurs.length === 0 && propres === 0) {
    return { score: null, label: null, state: stateOf(nonMesures.map((p) => p.state)) };
  }

  // ── MESURÉ, MAIS AUCUN SIGNAL À NOTER ──────────────────────────────────
  //
  // Des moteurs ont tourné et n'ont rien trouvé. La question « à quel point
  // sommes-nous sûrs des signaux trouvés » ne S'APPLIQUE PAS — il n'y en a
  // pas. Ce n'est ni une lacune ni un échec : c'est hors sujet, et le score
  // 0/LOW est conservé tel quel pour ne pas déplacer une sortie déjà servie.
  if (valeurs.length === 0) {
    return { score: 0, label: "LOW", state: "NOT_APPLICABLE" };
  }

  const raw =
    valeurs.reduce((a, b) => a + b.value, 0) / valeurs.length;
  const score = Math.round(raw * 1000) / 1000;

  const label: ReflexConfidence =
    score >= GLOBAL_CONFIDENCE_HIGH_THRESHOLD
      ? "HIGH"
      : score >= GLOBAL_CONFIDENCE_MEDIUM_THRESHOLD
        ? "MEDIUM"
        : "LOW";

  return { score, label, state: "MEASURED" };
}
