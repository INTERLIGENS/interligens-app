/**
 * REFLEX V1 — intelligence overlay adapter.
 *
 * Looks the input address up in the intelligence matcher (OFAC/AMF/FCA
 * regulatory feeds + GoPlus-style technical sources). When the match has
 * hasSanction=true, the emitted signal sets stopTrigger=true (per spec:
 * regulatory sanction = STOP).
 *
 * Intentionally independent from runTigerScore({withIntel:true}). Having
 * the regulatory hit as a first-class signal lets the verdict layer cite
 * it directly in the manifest without re-parsing TigerScore internals.
 */
import { lookupValue } from "@/lib/intelligence";
import type { IntelSignal } from "@/lib/intelligence/types";
import type {
  ReflexEngineOutput,
  ReflexResolvedInput,
  ReflexSignal,
} from "../types";

const REFLEX_CHAIN_TO_INTEL: Record<string, string> = {
  sol: "solana",
  eth: "ethereum",
  base: "base",
  bsc: "bsc",
  arbitrum: "arbitrum",
  tron: "tron",
  hyper: "hyper",
};

function intelChain(reflexChain: string | undefined): string | undefined {
  if (!reflexChain) return undefined;
  // Generic "evm" probes the canonical Ethereum slug — the underlying
  // matcher's chain is informational, not a strict filter.
  if (reflexChain === "evm") return "ethereum";
  return REFLEX_CHAIN_TO_INTEL[reflexChain];
}

export async function runIntelligenceOverlay(
  input: ReflexResolvedInput,
): Promise<ReflexEngineOutput<IntelSignal>> {
  const start = Date.now();
  const ms = () => Date.now() - start;

  if (!input.address) {
    return {
      engine: "intelligenceOverlay",
      ran: false,
      ms: ms(),
      signals: [],
    };
  }

  try {
    const signal = await lookupValue(input.address, intelChain(input.chain));
    if (!signal || signal.matchCount === 0) {
      return {
        engine: "intelligenceOverlay",
        ran: true,
        ms: ms(),
        signals: [],
        raw: signal,
      };
    }

    const reflexSignal: ReflexSignal = {
      source: "intelligenceOverlay",
      code: signal.hasSanction
        ? "intelligenceOverlay.sanction"
        : "intelligenceOverlay.match",
      severity: signal.hasSanction ? "CRITICAL" : "STRONG",
      confidence: signal.hasSanction ? 1.0 : 0.8,
      stopTrigger: signal.hasSanction,
      reasonEn: "Address matches a known risk pattern.",
      reasonFr: "L'adresse correspond à un schéma de risque connu.",
      payload: {
        matchCount: signal.matchCount,
        hasSanction: signal.hasSanction,
        topRiskClass: signal.topRiskClass,
        matchBasis: signal.matchBasis,
        sourceSlug: signal.sourceSlug,
        ims: signal.ims,
        ics: signal.ics,
      },
    };

    return {
      engine: "intelligenceOverlay",
      ran: true,
      ms: ms(),
      signals: [reflexSignal],
      raw: signal,
    };
  } catch (e) {
    return {
      engine: "intelligenceOverlay",
      ran: false,
      ms: ms(),
      signals: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
