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
import { computeGlobalConfidence } from "./confidence";
import { contractAbsenceReason } from "./engineContract";
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

  // ─── BUILD 11.1 — LA CAUSE EST RECALCULÉE, PAS DEVINÉE ────────────────
  //
  // `reason` n'est pas persisté : le manifeste est HACHÉ, et y ajouter un
  // champ déplacerait `signalsHash`, donc la déduplication et le contrat de
  // calibration. Rendre `UNKNOWN` pour tout le monde était donc commode — et
  // c'était réeffondrer l'axe de mesure sur le chemin de relecture, exactement
  // ce que la production m'a montré une fois déjà sur `confidenceState`.
  //
  // La règle étant PURE et fonction de `(moteur, type d'entrée)`, elle se
  // rejoue exactement : `inputType` est persisté sur la ligne. Même fonction
  // que l'orchestrateur, même résultat.
  //
  // Ce qui reste réellement perdu est nommé : `error` n'étant pas persisté,
  // une panne et un « jamais sollicité sans cause » se confondent en UNKNOWN.
  const typeEntree = row.inputType as ReflexResolvedInput["type"];
  const decrits = enginesCoverage
    .filter((e) => e.ran !== true)
    .map((e) => {
      const engine = (e.engine ?? "unknown") as ReflexSignalSource;
      return {
        engine,
        reason: (contractAbsenceReason(engine, typeEntree) ?? "UNKNOWN") as MeasurementState,
      };
    });
  const horsContrat = new Set<MeasurementState>(["NOT_APPLICABLE", "NOT_REQUESTED_BY_CONTRACT"]);
  const notExpected = decrits.filter((d) => horsContrat.has(d.reason));
  const missing = decrits.filter((d) => !horsContrat.has(d.reason));
  const measured = enginesCoverage.filter((e) => e.ran === true).length;
  const coverage = {
    total: enginesCoverage.length,
    measured,
    expected: enginesCoverage.length - notExpected.length,
    expectedMeasured: measured,
    missing,
    notExpected,
  };

  // Les colonnes `confidence` / `confidenceScore` ne sont pas nullables et le
  // DDL est hors périmètre. Sur INSUFFICIENT_COVERAGE, la valeur stockée n'est
  // qu'un remplissage de colonne : elle n'est JAMAIS servie. Le verdict fait
  // autorité, et la lecture rend `null` — le zéro ne sort pas d'ici.
  const rienMesure = row.verdict === "INSUFFICIENT_COVERAGE";

  // ─── L'ÉTAT DE CONFIANCE EST RECALCULÉ, PAS APLATI ─────────────────────
  //
  // La première version rendait `MEASURED` dès que le verdict n'était pas
  // INSUFFICIENT_COVERAGE. Mesuré en production le 2026-09-08 : une réponse
  // dédupliquée sortait `confidenceState: MEASURED` avec `score: 0` alors que
  // quatre moteurs avaient tourné SANS signal — l'état exact est
  // NOT_APPLICABLE, « il n'y a pas de signal dont on puisse être confiant ».
  //
  // C'est l'axe de mesure réeffondré sur le chemin de relecture, par le même
  // raccourci que BUILD 11 ferme ailleurs. Il est donc RECALCULÉ :
  // `computeGlobalConfidence` ne dépend que de `ran` et `signals`, tous deux
  // persistés, donc la distinction MEASURED / NOT_APPLICABLE est exacte.
  //
  // Ce qui reste inexact après coup est nommé : `error` n'étant pas persisté,
  // FAILURE et NOT_MEASURED se confondent en UNKNOWN. C'est une perte réelle,
  // et UNKNOWN est le mot pour la dire.
  const enginesRejoues = enginesCoverage.map((e, i) => ({
    engine: (e.engine ?? "unknown") as ReflexSignalSource,
    ran: e.ran === true,
    ms: 0,
    signals: (enginesArr[i]?.signals ?? []) as ReflexSignal[],
  }));
  const confianceRejouee = computeGlobalConfidence(enginesRejoues);

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
    conflicts: decide(enginesRejoues).conflicts,
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
    confidenceState: confianceRejouee.state,
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
