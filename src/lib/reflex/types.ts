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
  | "UNKNOWN";

export type ReflexChain =
  | "sol"
  | "eth"
  | "base"
  | "bsc"
  | "arbitrum"
  | "tron"
  | "hyper"
  | "unknown";

export type ReflexVerdict = "STOP" | "WAIT" | "VERIFY" | "NO_CRITICAL_SIGNAL";

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

export interface ReflexVerdictResult {
  verdict: ReflexVerdict;
  verdictReasonEn: string[];
  verdictReasonFr: string[];
  actionEn: string;
  actionFr: string;
  confidence: ReflexConfidence;
  confidenceScore: number;
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
