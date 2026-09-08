/**
 * REFLEX V1 — shared types.
 *
 * The verdict layer is fully deterministic: it consumes a flat ReflexSignal
 * array and emits a ReflexVerdictResult. No LLM participates in the
 * decision; LLM is only used downstream by ASK to explain a verdict
 * already computed from structured signals.
 */

export type ReflexInputType =
  | "SOLANA_TOKEN"
  | "EVM_TOKEN"
  | "WALLET"
  | "URL"
  | "X_HANDLE"
  | "TICKER"
  | "UNKNOWN";

export type ReflexChain =
  | "sol"
  | "evm"
  | "eth"
  | "base"
  | "bsc"
  | "arbitrum"
  | "tron"
  | "hyper"
  | "unknown";

import type { MeasurementState } from "@/lib/publication/absenceVocabulary";

export type ReflexVerdict =
  | "STOP"
  | "WAIT"
  | "VERIFY"
  | "NO_CRITICAL_SIGNAL"
  /**
   * REFLEX n'a AUCUNE mesure réussie à partir de laquelle conclure sur les
   * signaux critiques. Ce n'est pas un jugement sur l'actif : c'est un constat
   * sur nous.
   *
   * Les quatre autres verdicts sont des assertions sur ce qui a été TROUVÉ.
   * Aucun ne pouvait dire « nous n'avons pas pu mesurer » sans être faux —
   * `NO_CRITICAL_SIGNAL` promettait une absence de signal jamais cherchée, et
   * `VERIFY` aurait affirmé des claims que personne n'avait vus.
   *
   * SEUL DÉCLENCHEUR GOUVERNÉ : `coverage.measured === 0`. Aucun seuil n'existe
   * entre 1/8 et 7/8, et aucun n'est inventé ici : une couverture partielle
   * garde son verdict et EXPOSE sa couverture.
   */
  | "INSUFFICIENT_COVERAGE";

export type ReflexConfidence = "HIGH" | "MEDIUM" | "LOW";

export type ReflexMode = "SHADOW" | "PUBLIC";

export type ReflexLocale = "en" | "fr";

export type ReflexSignalSource =
  | "tigerscore"
  | "offchain"
  | "coordination"
  | "knownBad"
  | "intelligenceOverlay"
  | "recidivism"
  | "casefileMatch"
  | "narrative";

export type ReflexSignalSeverity = "WEAK" | "MODERATE" | "STRONG" | "CRITICAL";

export interface ReflexInput {
  raw: string;
  locale: ReflexLocale;
  mode?: ReflexMode;
}

export interface ReflexResolvedInput {
  type: ReflexInputType;
  chain?: ReflexChain;
  address?: string;
  handle?: string;
  url?: string;
  /** Uppercased ticker symbol, $-prefix stripped (e.g. "BOTIFY"). Resolved
   *  to candidate addresses downstream via /api/scan/resolve. */
  ticker?: string;
  raw: string;
}

/**
 * A single signal produced by one of the engines. The verdict layer
 * consumes a flat list of these to apply the decision matrix.
 */
export interface ReflexSignal {
  source: ReflexSignalSource;
  /** Stable code, e.g. "tigerscore.driver.unlimitedApprovals", "narrative.LISTING_IMMINENT" */
  code: string;
  severity: ReflexSignalSeverity;
  /** 0..1 — how confident this engine is in this signal */
  confidence: number;
  /** When true, this signal alone is sufficient to trigger STOP. */
  stopTrigger?: boolean;
  /** Rendered reason fragment, ready to surface in the verdict card. */
  reasonEn?: string;
  reasonFr?: string;
  /** Arbitrary structured payload, persisted into the manifest. */
  payload?: Record<string, unknown>;
}

export interface ReflexEngineOutput<T = unknown> {
  engine: ReflexSignalSource;
  ran: boolean;
  ms: number;
  signals: ReflexSignal[];
  raw?: T;
  error?: string;
}

/**
 * L'état d'UN moteur, tel qu'un consommateur doit pouvoir le lire.
 *
 * `ran` et `error` existaient déjà sur `ReflexEngineOutput` : les adaptateurs
 * les posaient honnêtement, et ils étaient jetés au point de consommation.
 * Ceci les fait survivre — c'est une réparation, pas une invention.
 */
export interface ReflexEngineCoverage {
  engine: ReflexSignalSource;
  /** L'état de mesure — axe MESURE, jamais un état de publication. */
  reason: MeasurementState;
  /** La cause de l'échec, quand il y en a une. Jamais fabriquée. */
  detail?: string;
}

/**
 * La couverture de mesure. Elle VOYAGE À CÔTÉ du verdict, jamais dedans.
 *
 * Une couverture partielle ne change pas le verdict — le ruling est explicite :
 * 4/8 n'a pas à conclure autrement que 8/8, il doit EXPOSER autre chose.
 */
export interface ReflexCoverage {
  /** Moteurs sollicités. */
  total: number;
  /** Moteurs ayant réellement tourné. */
  measured: number;
  /** Ceux qui n'ont pas tourné, chacun avec son état et sa cause. */
  missing: ReflexEngineCoverage[];
}

export interface ReflexVerdictResult {
  verdict: ReflexVerdict;
  verdictReasonEn: string[];
  verdictReasonFr: string[];
  actionEn: string;
  actionFr: string;
  /** `null` quand rien n'a été mesuré — voir `confidenceScore`. */
  confidence: ReflexConfidence | null;
  /**
   * `null` quand RIEN n'a été mesuré. Jamais `0` : zéro est une confiance
   * mesurée à zéro, l'absence de mesure n'en est pas une.
   */
  confidenceScore: number | null;
  /** L'état de la mesure de confiance, à côté du nombre. */
  confidenceState: MeasurementState;
  /** Ce qui a été mesuré, et ce qui ne l'a pas été. */
  coverage: ReflexCoverage;
  /** `true` dès qu'au moins un moteur n'a pas pu se prononcer. */
  degraded: boolean;
  /**
   * Ce qui a été observé et n'apparaît pas dans l'explication du verdict.
   * Résoudre prudemment ne dispense pas de DIRE que deux moteurs divergent.
   */
  conflicts: { engine: ReflexSignalSource; code: string; severity: ReflexSignalSeverity }[];
}

export interface ReflexAnalysisResult extends ReflexVerdictResult {
  id: string;
  createdAt: Date;
  input: ReflexResolvedInput;
  signals: ReflexSignal[];
  signalsManifest: Record<string, unknown>;
  signalsHash: string;
  enginesVersion: string;
  mode: ReflexMode;
  latencyMs: number;
}

export interface ForbiddenMatch {
  token: string;
  snippet: string;
  index: number;
}
