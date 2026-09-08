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
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decide } from "./verdict";
import type { MeasurementState } from "@/lib/publication/absenceVocabulary";
import type {
  ReflexAnalysisResult,
  ReflexSignalSource,
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

  // ─── BUILD 11 — LA COUVERTURE EST RECONSTRUITE, PAS RÉINVENTÉE ────────
  //
  // Le manifeste persiste `engine` + `ran` par moteur : la couverture s'en
  // déduit exactement. Il ne persiste PAS `error` — et on ne l'y ajoute pas,
  // parce que le manifeste est HACHÉ : y toucher déplacerait `signalsHash`,
  // donc la déduplication et le contrat de calibration.
  //
  // Conséquence assumée : sur une relecture, un moteur manquant sort en
  // UNKNOWN et non FAILURE/NOT_MEASURED. C'est exact — après coup, on ne PEUT
  // plus distinguer les deux — et UNKNOWN est précisément le mot pour ça.
  const enginesCoverage = enginesArr as Array<{ engine?: string; ran?: boolean }>;
  const missing = enginesCoverage
    .filter((e) => e.ran !== true)
    .map((e) => ({
      engine: (e.engine ?? "unknown") as ReflexSignalSource,
      reason: "UNKNOWN" as MeasurementState,
    }));
  const coverage = {
    total: enginesCoverage.length,
    measured: enginesCoverage.filter((e) => e.ran === true).length,
    missing,
  };

  // Les colonnes `confidence` / `confidenceScore` ne sont pas nullables et le
  // DDL est hors périmètre. Sur INSUFFICIENT_COVERAGE, la valeur stockée n'est
  // qu'un remplissage de colonne : elle n'est JAMAIS servie. Le verdict fait
  // autorité, et la lecture rend `null` — le zéro ne sort pas d'ici.
  const rienMesure = row.verdict === "INSUFFICIENT_COVERAGE";

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
    coverage,
    // `conflicts` n'est pas persisté. Rendre `[]` affirmerait « aucune
    // contradiction », ce qui peut être faux — exactement la coercition qu'on
    // ferme ailleurs. Il est donc RECALCULÉ : `decide` est pure et les signaux
    // sont dans le manifeste, donc le résultat est le même qu'à l'origine.
    // Le verdict servi reste celui de la LIGNE, pas du recalcul.
    conflicts: decide(
      enginesCoverage.map((e, i) => ({
        engine: (e.engine ?? "unknown") as ReflexSignalSource,
        ran: e.ran === true,
        ms: 0,
        signals: (enginesArr[i]?.signals ?? []) as ReflexSignal[],
      })),
    ).conflicts,
    degraded: missing.length > 0,
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
    confidence: rienMesure ? null : (row.confidence as ReflexVerdictResult["confidence"]),
    confidenceScore: rienMesure ? null : row.confidenceScore,
    confidenceState: rienMesure ? "UNKNOWN" : "MEASURED",
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
      // Colonnes non nullables, DDL hors périmètre : sur une absence totale de
      // mesure, ces deux valeurs ne sont qu'un remplissage. Elles ne sont
      // jamais relues — `rowToResult` rend `null` dès que le verdict dit
      // INSUFFICIENT_COVERAGE, et c'est le verdict qui fait autorité.
      confidence: input.verdictResult.confidence ?? "LOW",
      confidenceScore: input.verdictResult.confidenceScore ?? 0,
      // Cast at the Prisma boundary: PersistInput keeps the broader
      // Record<string, unknown> shape (orchestrator-friendly) but Prisma's
      // generated InputJsonValue rejects `unknown` leaves. The manifest
      // is by construction JSON-safe — buildSignalsManifest filters out
      // anything else — so the cast is sound.
      signalsManifest: input.signalsManifest as Prisma.InputJsonValue,
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
