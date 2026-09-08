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
import type { MeasurementState } from "@/lib/publication/absenceVocabulary";
import type {
  ReflexCoverage,
  ReflexSignalSource,
  ReflexEngineCoverage,
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
  globalConfidenceScore: number | null,
): boolean {
  // Sans confiance mesurée, la convergence n'est pas établie. On ne la
  // suppose pas, et on ne la remplace pas par 0 : on refuse de conclure.
  if (globalConfidenceScore === null) return false;
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

/**
 * La couverture de mesure, lue sur les entrées de `decide()`.
 *
 * Le fait était DÉJÀ disponible : `ran` et `error` sont posés honnêtement par
 * les adaptateurs. Ils étaient simplement jetés ici. On les fait survivre.
 */
/**
 * Les signaux qui EXISTENT et n'ont pas motivé le verdict, alors qu'ils
 * viennent d'un autre moteur que ceux qui l'ont motivé.
 *
 * Ce n'est pas un jugement sur leur contenu : c'est le constat qu'une partie
 * de ce qui a été observé n'apparaît pas dans l'explication. Le lecteur doit
 * pouvoir le savoir sans avoir à croire que tout a été dit.
 */
function computeConflicts(
  signals: readonly ReflexSignal[],
  reasonsSource: readonly ReflexSignal[],
): { engine: ReflexSignalSource; code: string; severity: ReflexSignalSeverity }[] {
  const retenus = new Set(reasonsSource.map((s) => s.code));
  const moteursRetenus = new Set(reasonsSource.map((s) => s.source));
  if (moteursRetenus.size === 0) return [];
  return signals
    .filter((s) => !retenus.has(s.code) && !moteursRetenus.has(s.source))
    .map((s) => ({ engine: s.source, code: s.code, severity: s.severity }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function computeCoverage(engines: readonly ReflexEngineOutput[]): ReflexCoverage {
  const missing: ReflexEngineCoverage[] = engines
    .filter((e) => !e.ran)
    .map((e) => ({
      engine: e.engine,
      // `error` posé = tentative échouée ; absent = jamais sollicité.
      reason: (e.error ? "FAILURE" : "NOT_MEASURED") as MeasurementState,
      ...(e.error ? { detail: e.error } : {}),
    }));
  return {
    total: engines.length,
    measured: engines.filter((e) => e.ran).length,
    missing,
  };
}

function decideBranch(
  signals: ReflexSignal[],
  globalConfidenceScore: number | null,
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
  const {
    score: confidenceScore,
    label: confidence,
    state: confidenceState,
  } = computeGlobalConfidence(engines);

  const coverage = computeCoverage(engines);

  // ─── BUILD 11 — AUCUNE MESURE RÉUSSIE N'EST PAS UN CONSTAT ─────────────
  //
  // Avant, huit providers tombés tombaient dans la branche par défaut et
  // rendaient NO_CRITICAL_SIGNAL — « aucun signal critique détecté » — alors
  // que rien n'avait été cherché avec succès. C'est la coercition absence →
  // réassurance, à la sortie produit, devant un acheteur.
  //
  // SEUL DÉCLENCHEUR GOUVERNÉ : `measured === 0`. Aucun seuil n'existe entre
  // 1/8 et 7/8 et aucun n'est inventé : une couverture partielle garde son
  // verdict et expose sa couverture, qui voyage à côté.
  //
  // Le test se fait AVANT la matrice, et c'est délibéré : sans mesure, il n'y
  // a aucun signal à faire entrer dans les branches, donc rien à arbitrer.
  const { verdict, reasonsSource } =
    coverage.measured === 0
      ? ({ verdict: "INSUFFICIENT_COVERAGE", reasonsSource: [] } as DecisionDraft)
      : decideBranch(signals, confidenceScore);

  // Les raisons viennent de la MÊME autorité que le verdict — c'est la parité
  // explication/verdict, et elle est structurelle : une seule fonction produit
  // les trois, donc ils ne peuvent pas diverger.
  const raisons = (locale: "en" | "fr"): string[] => {
    if (verdict === "NO_CRITICAL_SIGNAL") return [DISCLAIMER_NO_SIGNAL[locale]];
    if (verdict === "INSUFFICIENT_COVERAGE") {
      // On NOMME ce qui manque, sans rien affirmer sur l'actif.
      const manquants = coverage.missing.map((m) => m.engine).join(", ");
      return locale === "en"
        ? [
            `NOT_MEASURED — 0 of ${coverage.total} engines completed a measurement.`,
            manquants ? `Engines without a result: ${manquants}.` : "",
          ].filter(Boolean)
        : [
            `NOT_MEASURED — 0 moteur sur ${coverage.total} n'a mené de mesure à bien.`,
            manquants ? `Moteurs sans résultat : ${manquants}.` : "",
          ].filter(Boolean);
    }
    return pickReasons(reasonsSource, locale);
  };
  const verdictReasonEn = raisons("en");
  const verdictReasonFr = raisons("fr");

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
    confidenceState,
    coverage,
    // ─── LA CONTRADICTION EST SIGNALÉE, PAS SEULEMENT RÉSOLUE ───────────
    //
    // « Premier match gagnant, et STOP est premier » résout prudemment — ce
    // comportement est correct et reste intact. Mais résoudre n'est pas
    // dire : le second signal disparaissait sans trace, et le lecteur ne
    // savait pas que deux moteurs se contredisaient.
    //
    // Aucune taxonomie n'est inventée ici, et c'est délibéré : décider quels
    // codes « disculpent » serait une méthodologie. On se contente d'un fait
    // STRUCTUREL et vérifiable — des moteurs DIFFÉRENTS ont produit des
    // signaux de sévérités opposées, et seuls certains ont motivé le verdict.
    conflicts: computeConflicts(signals, reasonsSource),
    // Dégradé dès qu'UN moteur n'a pas pu se prononcer — pas seulement à zéro.
    degraded: coverage.missing.length > 0,
  };
}
