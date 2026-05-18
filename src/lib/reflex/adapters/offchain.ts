/**
 * REFLEX V1 — off-chain credibility adapter.
 *
 * Wraps src/lib/off-chain-credibility/engine.ts. The upstream caller is
 * responsible for assembling the OffChainInput (websiteUrl, github, X
 * handle, etc.). The adapter translates the resulting score band into a
 * single ReflexSignal that contributes to the WAIT/VERIFY branches.
 *
 * Only LOW / VERY_LOW / MIXED bands emit a signal — GOOD and STRONG bands
 * are silent (no signal), since a project with credible off-chain
 * artifacts adds no risk signal of its own. The upstream summary_en/fr
 * is passed in payload only; reasonEn/Fr are intentionally not set so
 * the verdict layer can construct bilingual reasons from signal.code.
 */
import {
  computeOffChainCredibility,
  type OffChainInput,
  type OffChainResult,
} from "@/lib/off-chain-credibility/engine";
import type {
  ReflexEngineOutput,
  ReflexResolvedInput,
  ReflexSignal,
  ReflexSignalSeverity,
} from "../types";

function severityFromBand(
  b: OffChainResult["band"],
): ReflexSignalSeverity | null {
  if (b === "VERY_LOW") return "STRONG";
  if (b === "LOW") return "MODERATE";
  if (b === "MIXED") return "WEAK";
  return null;
}

function confidenceNumeric(c: OffChainResult["confidence"]): number {
  if (c === "HIGH") return 0.9;
  if (c === "MEDIUM") return 0.6;
  return 0.3;
}

export type RunOffChainOpts = {
  resolvedInput: ReflexResolvedInput;
  offChainInput: OffChainInput;
};

export async function runOffChain(
  opts: RunOffChainOpts,
): Promise<ReflexEngineOutput<OffChainResult>> {
  const start = Date.now();
  const ms = () => Date.now() - start;
  try {
    const result = await computeOffChainCredibility(opts.offChainInput);
    const severity = severityFromBand(result.band);

    const signals: ReflexSignal[] = [];
    if (severity) {
      signals.push({
        source: "offchain",
        code: `offchain.band.${result.band.toLowerCase()}`,
        severity,
        confidence: confidenceNumeric(result.confidence),
        stopTrigger: false,
        payload: {
          score: result.score,
          band: result.band,
          tiger_modifier: result.tiger_modifier,
          domainAgeDays: result.domainAgeDays ?? null,
          summaryEn: result.summary_en,
          summaryFr: result.summary_fr,
          subsignals: result.signals.map((s) => ({
            id: s.id,
            status: s.status,
            score: s.score,
            max_score: s.max_score,
          })),
        },
      });
    }

    return {
      engine: "offchain",
      ran: true,
      ms: ms(),
      signals,
      raw: result,
    };
  } catch (e) {
    return {
      engine: "offchain",
      ran: false,
      ms: ms(),
      signals: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
