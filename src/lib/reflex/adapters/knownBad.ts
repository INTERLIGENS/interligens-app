/**
 * REFLEX V1 — knownBad adapter.
 *
 * Wraps src/lib/entities/knownBad.ts. Emits one signal when the input
 * address matches a curated known-bad entry. Confidence "high" entries
 * set stopTrigger=true — per spec, a high-confidence knownBad hit is a
 * sufficient STOP trigger on its own. Pure synchronous function, no I/O.
 */
import { isKnownBad, isKnownBadEvm } from "@/lib/entities/knownBad";
import type {
  ReflexEngineOutput,
  ReflexResolvedInput,
  ReflexSignal,
  ReflexSignalSeverity,
} from "../types";

const CHAIN_MAP_TO_UPSTREAM: Record<string, string> = {
  sol: "SOL",
  eth: "ETH",
  base: "BASE",
  arbitrum: "ARBITRUM",
  bsc: "BSC",
  tron: "TRON",
  hyper: "HYPER",
};

function severityFromConfidence(
  c: "low" | "medium" | "high",
): ReflexSignalSeverity {
  if (c === "high") return "CRITICAL";
  if (c === "medium") return "STRONG";
  return "MODERATE";
}

function confidenceNumeric(c: "low" | "medium" | "high"): number {
  if (c === "high") return 1.0;
  if (c === "medium") return 0.8;
  return 0.5;
}

export function runKnownBad(input: ReflexResolvedInput): ReflexEngineOutput {
  const start = Date.now();
  const ms = () => Date.now() - start;

  if (!input.address) {
    return { engine: "knownBad", ran: false, ms: ms(), signals: [] };
  }

  // Generic "evm" chain probes every registered EVM chain (ETH/BASE/ARBITRUM/BSC).
  const hit =
    input.chain === "evm"
      ? isKnownBadEvm(input.address)
      : input.chain
        ? isKnownBad(
            CHAIN_MAP_TO_UPSTREAM[input.chain] ?? input.chain.toUpperCase(),
            input.address,
          )
        : null;

  if (!hit) {
    return { engine: "knownBad", ran: true, ms: ms(), signals: [] };
  }

  const signal: ReflexSignal = {
    source: "knownBad",
    code: `knownBad.${hit.category}.${hit.chain.toLowerCase()}`,
    severity: severityFromConfidence(hit.confidence),
    confidence: confidenceNumeric(hit.confidence),
    stopTrigger: hit.confidence === "high",
    // Reason text is the spec's allowed-phrase wording so the lint cannot
    // trip on category labels like "Known Scam Router" that live in hit.label.
    reasonEn: "Address matches a known risk pattern.",
    reasonFr: "L'adresse correspond à un schéma de risque connu.",
    payload: {
      label: hit.label,
      category: hit.category,
      chain: hit.chain,
      confidence: hit.confidence,
    },
  };

  return {
    engine: "knownBad",
    ran: true,
    ms: ms(),
    signals: [signal],
    raw: hit,
  };
}
