// ─── Token candidate scoring / cashtag decision ────────────────────────────
// Pure logic. Reuses the scan resolver's already-shared primitives from
// marketProviders.ts (GENERIC_TICKERS, normalizeSymbol, tickerMatchType,
// the ResolvedTokenCandidate shape produced by searchDexScreenerPairs) so the
// bridge and the public scan never diverge on what "exact / plausible / generic"
// means. Output is expressed in the bridge's richer status/confidence model.

import {
  GENERIC_TICKERS,
  normalizeSymbol,
  type ResolvedTokenCandidate,
  type TickerMatchType,
} from "@/lib/marketProviders";

export type Confidence = "LOW" | "MODERATE" | "HIGH";

// Chains we will auto-resolve this sprint (app is Solana-first).
const KNOWN_AUTORESOLVE_CHAINS = new Set<string>(["SOL"]);

// Output candidate shape (contract). Decoupled from the internal
// ResolvedTokenCandidate so consumers don't depend on marketProviders types.
export interface TokenCandidate {
  chain: string;
  mint: string;
  symbol: string;
  name: string | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  matchType: TickerMatchType | "explicit_ca";
  source: "dexscreener" | "explicit_ca";
}

export function toTokenCandidate(c: ResolvedTokenCandidate): TokenCandidate {
  return {
    chain: c.chain,
    mint: c.mint,
    symbol: c.ticker,
    name: c.name,
    liquidityUsd: c.liquidityUsd,
    volume24hUsd: c.volume24hUsd,
    matchType: c.matchType,
    source: "dexscreener",
  };
}

export interface CashtagDecision {
  status: "RESOLVED" | "AMBIGUOUS" | "UNRESOLVED";
  confidence: Confidence;
  method: "dexscreener_exact" | "dexscreener_ranked" | "none";
  winner: ResolvedTokenCandidate | null;
  candidates: ResolvedTokenCandidate[];
  limitations: string[];
}

// Decide canonical resolution from a DexScreener hit list (already filtered,
// matched, grouped and sorted by searchDexScreenerPairs). Invariants mirror the
// scan's decideResolution:
//   • generic ticker (blocklist)        → never auto-resolve
//   • ≥2 distinct exact-symbol mints     → genuinely ambiguous
//   • single exact, known chain, liquid  → resolve (HIGH)
//   • prefix-only / low-liquidity / off-chain → ambiguous
// GOLDEN RULE: never HIGH while more than one plausible candidate remains.
export function decideCashtag(
  cashtag: string,
  hits: ResolvedTokenCandidate[],
): CashtagDecision {
  const cn = normalizeSymbol(cashtag);

  if (hits.length === 0) {
    return {
      status: "UNRESOLVED",
      confidence: "LOW",
      method: "none",
      winner: null,
      candidates: [],
      limitations: ["no DexScreener pair matched this cashtag"],
    };
  }

  const exacts = hits.filter((h) => h.matchType === "exact");
  const plausibleExacts = exacts.filter(
    (h) => KNOWN_AUTORESOLVE_CHAINS.has(h.chain) && !h.lowLiquidity,
  );

  // Generic ticker → never auto-resolve, regardless of hit count.
  if (GENERIC_TICKERS.has(cn)) {
    return {
      status: "AMBIGUOUS",
      confidence: "LOW",
      method: "dexscreener_ranked",
      winner: null,
      candidates: hits,
      limitations: ["generic ticker (blocklist) — manual disambiguation required"],
    };
  }

  // ≥2 distinct exact-symbol tokens → genuinely ambiguous.
  if (exacts.length >= 2) {
    return {
      status: "AMBIGUOUS",
      confidence: plausibleExacts.length >= 1 ? "MODERATE" : "LOW",
      method: "dexscreener_ranked",
      winner: null,
      candidates: hits,
      limitations: [`${exacts.length} distinct exact-symbol tokens — genuinely ambiguous`],
    };
  }

  // Exactly one exact match.
  if (exacts.length === 1) {
    const e = exacts[0];
    if (KNOWN_AUTORESOLVE_CHAINS.has(e.chain) && !e.lowLiquidity) {
      return {
        status: "RESOLVED",
        confidence: "HIGH",
        method: "dexscreener_exact",
        winner: e,
        candidates: [e],
        limitations: [],
      };
    }
    return {
      status: "AMBIGUOUS",
      confidence: "LOW",
      method: "dexscreener_ranked",
      winner: null,
      candidates: hits,
      limitations: [
        e.lowLiquidity
          ? "single exact match but liquidity < $1000 — not auto-resolved"
          : `single exact match on non-auto-resolve chain ${e.chain}`,
      ],
    };
  }

  // Only prefix matches left.
  return {
    status: "AMBIGUOUS",
    confidence: "LOW",
    method: "dexscreener_ranked",
    winner: null,
    candidates: hits,
    limitations: ["only prefix (non-exact) matches — never auto-resolved"],
  };
}
