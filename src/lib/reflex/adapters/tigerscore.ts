/**
 * REFLEX V1 — TigerScore adapter.
 *
 * Wraps src/lib/tigerscore/engine.ts. The verdict pipeline upstream is
 * responsible for building the TigerInput (typically by fanning out to
 * the /api/scan/evm and /api/scan/solana routes). This adapter does not
 * perform any I/O of its own.
 *
 * Each TigerScore driver becomes one ReflexSignal. stopTrigger is left
 * false on every TigerScore signal: in V1, TigerScore alone never forces
 * STOP — STOP comes from convergence (recidivist + ≥2 CRITICAL drivers +
 * confidence ≥ threshold), or from a casefile/knownBad/intelligence hit.
 *
 * reasonEn/reasonFr are intentionally not set here. The verdict layer
 * builds bilingual user-facing reasons from signal.code via a localization
 * map; that keeps the output lint isolated from the upstream label vocab.
 */
import {
  computeTigerScore,
  computeTigerScoreWithIntel,
  type TigerInput,
  type TigerResult,
  type TigerResultWithIntel,
} from "@/lib/tigerscore/engine";
import type {
  ReflexEngineOutput,
  ReflexResolvedInput,
  ReflexSignal,
  ReflexSignalSeverity,
} from "../types";

function mapDriverSeverity(
  s: "low" | "med" | "high" | "critical",
): ReflexSignalSeverity {
  if (s === "critical") return "CRITICAL";
  if (s === "high") return "STRONG";
  if (s === "med") return "MODERATE";
  return "WEAK";
}

function confidenceNumeric(c: TigerResult["confidence"]): number {
  if (c === "High") return 0.9;
  if (c === "Medium") return 0.6;
  return 0.3;
}

function driversToSignals(
  result: TigerResult | TigerResultWithIntel,
): ReflexSignal[] {
  const confNum = confidenceNumeric(result.confidence);
  return result.drivers.map((d) => ({
    source: "tigerscore" as const,
    code: `tigerscore.${d.id}`,
    severity: mapDriverSeverity(d.severity),
    confidence: confNum,
    stopTrigger: false,
    payload: {
      id: d.id,
      label: d.label,
      delta: d.delta,
      why: d.why,
      severity: d.severity,
    },
  }));
}

export type RunTigerScoreOpts = {
  resolvedInput: ReflexResolvedInput;
  tigerInput: TigerInput;
  /** When true and the input has an address, applies OFAC/AMF/FCA overlay. */
  withIntel?: boolean;
};

export async function runTigerScore(
  opts: RunTigerScoreOpts,
): Promise<ReflexEngineOutput<TigerResult | TigerResultWithIntel>> {
  const start = Date.now();
  const ms = () => Date.now() - start;
  try {
    const result: TigerResult | TigerResultWithIntel =
      opts.withIntel && opts.resolvedInput.address
        ? await computeTigerScoreWithIntel(
            opts.tigerInput,
            opts.resolvedInput.address,
          )
        : computeTigerScore(opts.tigerInput);
    return {
      engine: "tigerscore",
      ran: true,
      ms: ms(),
      signals: driversToSignals(result),
      raw: result,
    };
  } catch (e) {
    return {
      engine: "tigerscore",
      ran: false,
      ms: ms(),
      signals: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
