/**
 * REFLEX V1 — persistence layer.
 *
 * Three responsibilities:
 *  - effectiveMode(): force SHADOW unless REFLEX_PUBLIC_ENABLED=="true".
 *    Belt-and-suspenders gate so a caller can't accidentally write
 *    mode="PUBLIC" rows by passing the wrong arg.
 *  - findRecentByHash(): dedup window (default 60 s). If the same
 *    signalsHash has been persisted recently, return that row instead
 *    of writing a duplicate.
 *  - persistAnalysis(): write a new ReflexAnalysis row.
 *
 * All read paths inflate a Prisma row back into a ReflexAnalysisResult.
 */
import { prisma } from "@/lib/prisma";
import type {
  ReflexAnalysisResult,
  ReflexEngineOutput,
  ReflexMode,
  ReflexResolvedInput,
  ReflexSignal,
  ReflexVerdictResult,
} from "./types";

export const DEDUP_WINDOW_SECONDS = 60;
const REFLEX_PUBLIC_ENABLED_ENV = "REFLEX_PUBLIC_ENABLED";

/**
 * mode="PUBLIC" requires both:
 *   - the caller requested it
 *   - REFLEX_PUBLIC_ENABLED env is the literal string "true"
 *
 * Any other combination collapses to "SHADOW". This is the single gate
 * keeping shadow-phase calibration safe from a misconfigured caller.
 */
export function effectiveMode(requested?: ReflexMode): ReflexMode {
  if (
    requested === "PUBLIC" &&
    process.env[REFLEX_PUBLIC_ENABLED_ENV] === "true"
  ) {
    return "PUBLIC";
  }
  return "SHADOW";
}

function rowToResult(row: {
  id: string;
  createdAt: Date;
  inputRaw: string;
  inputType: string;
  inputChain: string | null;
  inputResolvedAddress: string | null;
  inputResolvedHandle: string | null;
  verdict: string;
  verdictReasonEn: unknown;
  verdictReasonFr: unknown;
  actionEn: string;
  actionFr: string;
  confidence: string;
  confidenceScore: number;
  signalsManifest: unknown;
  signalsHash: string;
  tigerScoreSnapshot: number | null;
  mode: string;
  investigatorId: string | null;
  latencyMs: number;
  enginesVersion: string;
}): ReflexAnalysisResult {
  const manifest = (row.signalsManifest ?? {}) as Record<string, unknown>;
  const enginesArr = Array.isArray(
    (manifest as { engines?: unknown }).engines,
  )
    ? ((manifest as { engines: unknown[] }).engines as Array<{
        signals?: ReflexSignal[];
      }>)
    : [];
  const signals: ReflexSignal[] = enginesArr.flatMap((e) =>
    Array.isArray(e.signals) ? (e.signals as ReflexSignal[]) : [],
  );

  return {
    id: row.id,
    createdAt: row.createdAt,
    input: {
      type: row.inputType as ReflexResolvedInput["type"],
      chain: (row.inputChain ?? undefined) as ReflexResolvedInput["chain"],
      address: row.inputResolvedAddress ?? undefined,
      handle: row.inputResolvedHandle ?? undefined,
      raw: row.inputRaw,
    },
    signals,
    signalsManifest: manifest,
    signalsHash: row.signalsHash,
    enginesVersion: row.enginesVersion,
    mode: row.mode as ReflexMode,
    latencyMs: row.latencyMs,
    verdict: row.verdict as ReflexVerdictResult["verdict"],
    verdictReasonEn: Array.isArray(row.verdictReasonEn)
      ? (row.verdictReasonEn as string[])
      : [],
    verdictReasonFr: Array.isArray(row.verdictReasonFr)
      ? (row.verdictReasonFr as string[])
      : [],
    actionEn: row.actionEn,
    actionFr: row.actionFr,
    confidence: row.confidence as ReflexVerdictResult["confidence"],
    confidenceScore: row.confidenceScore,
  };
}

/**
 * Return the most recent ReflexAnalysis with the given signalsHash within
 * the dedup window, or null if none.
 */
export async function findRecentByHash(
  signalsHash: string,
  withinSeconds: number = DEDUP_WINDOW_SECONDS,
): Promise<ReflexAnalysisResult | null> {
  const since = new Date(Date.now() - withinSeconds * 1000);
  const row = await prisma.reflexAnalysis.findFirst({
    where: { signalsHash, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });
  return row ? rowToResult(row) : null;
}

export async function findById(
  id: string,
): Promise<ReflexAnalysisResult | null> {
  const row = await prisma.reflexAnalysis.findUnique({ where: { id } });
  return row ? rowToResult(row) : null;
}

export interface PersistInput {
  resolvedInput: ReflexResolvedInput;
  inputRaw: string;
  engines: readonly ReflexEngineOutput[];
  verdictResult: ReflexVerdictResult;
  signalsManifest: Record<string, unknown>;
  signalsHash: string;
  tigerScoreSnapshot?: number | null;
  /** Requested mode — coerced through effectiveMode() before write. */
  mode?: ReflexMode;
  investigatorId?: string;
  latencyMs: number;
  enginesVersion: string;
}

/**
 * Write a new ReflexAnalysis row. Always coerces mode through
 * effectiveMode() — even if the caller passes mode="PUBLIC", the row
 * lands as "SHADOW" unless REFLEX_PUBLIC_ENABLED is explicitly "true".
 */
export async function persistAnalysis(
  input: PersistInput,
): Promise<ReflexAnalysisResult> {
  const mode = effectiveMode(input.mode);
  const row = await prisma.reflexAnalysis.create({
    data: {
      inputRaw: input.inputRaw,
      inputType: input.resolvedInput.type,
      inputChain: input.resolvedInput.chain ?? null,
      inputResolvedAddress: input.resolvedInput.address ?? null,
      inputResolvedHandle: input.resolvedInput.handle ?? null,
      verdict: input.verdictResult.verdict,
      verdictReasonEn: input.verdictResult.verdictReasonEn,
      verdictReasonFr: input.verdictResult.verdictReasonFr,
      actionEn: input.verdictResult.actionEn,
      actionFr: input.verdictResult.actionFr,
      confidence: input.verdictResult.confidence,
      confidenceScore: input.verdictResult.confidenceScore,
      signalsManifest: input.signalsManifest,
      signalsHash: input.signalsHash,
      tigerScoreSnapshot: input.tigerScoreSnapshot ?? null,
      mode,
      investigatorId: input.investigatorId ?? null,
      latencyMs: input.latencyMs,
      enginesVersion: input.enginesVersion,
    },
  });
  return rowToResult(row);
}
