// src/lib/proceeds/policy.ts
// INTERLIGENS Proceeds Policy v1.0.0
// Defines exactly what constitutes a provably documented cashout.

export const PROCEEDS_POLICY = {
  version: "1.0.0",

  // ── CASHOUT_DOCUMENTED (totalDocumented) ──────────────────────────────────
  // On-chain evidence strong enough to assert the KOL received fiat-equivalent value.
  //
  //   INCLUDED:
  //   - Swap DEX (Jupiter/Raydium) token → SOL/USDC/USDT
  //   - Direct deposit to known CEX (Binance, Coinbase, OKX, …)
  //   - Sale via aggregator with stable output
  //   - Multi-hop if final leg = CEX or stable
  //
  //   EXCLUDED:
  //   - Token purchases
  //   - Inter-wallet transfers within same cluster
  //   - Transaction fees
  //   - Staking / LP deposits
  //   - NFT mints

  // ── CASHOUT_OBSERVED (totalObserved — future) ─────────────────────────────
  // Suggestive but unconfirmed exit.
  //
  //   OBSERVED:
  //   - Cross-chain bridge without known CEX destination
  //   - Transfer to unknown wallet > $10K
  //   - Partial exit < 10% of position

  // ── Thresholds ────────────────────────────────────────────────────────────
  MIN_CASHOUT_USD: 10,
  MAX_HOP_DEPTH: 3,
  PARTIAL_EXIT_THRESHOLD: 0.10,
  LARGE_TRANSFER_USD: 10_000,

  // ── Confidence levels ─────────────────────────────────────────────────────
  CEX_DEPOSIT_CONFIDENCE: "documented" as const,
  DEX_SWAP_CONFIDENCE: "documented" as const,
  BRIDGE_CONFIDENCE: "observed" as const,
} as const;

// ── Event type taxonomy ───────────────────────────────────────────────────────

// Documented: counted in totalDocumented
const DOCUMENTED_TYPES = new Set([
  "cex_deposit",
  "jupiter_swap",
  "raydium_swap",
  "dex_sell",
  "TRADE",
  "SUMMARY_ARKHAM",
  "aggregator_swap",
  "multi_hop_cex",
]);

// Observed: counted in totalObserved (future field), not in totalDocumented
const OBSERVED_TYPES = new Set([
  "bridge",
  "large_transfer",
  "partial_exit",
]);

// Excluded: never counted
const EXCLUDED_TYPES = new Set([
  "buy",
  "token_purchase",
  "swap",            // ambiguous — no clear SOL/stable output
  "internal_transfer",
  "fee",
  "staking",
  "lp_deposit",
  "nft_mint",
  "nft_purchase",
  "airdrop_claim",
]);

export type CashoutConfidence = "documented" | "observed" | "excluded";

/**
 * Returns the confidence classification for a given event type.
 * Unknown types default to "excluded" (fail-closed).
 */
export function getCashoutConfidence(eventType: string): CashoutConfidence {
  if (DOCUMENTED_TYPES.has(eventType)) return "documented";
  if (OBSERVED_TYPES.has(eventType)) return "observed";
  return "excluded";
}

/**
 * True if the event should be counted in totalDocumented.
 * Requires both a documented event type AND amount ≥ MIN_CASHOUT_USD.
 */
export function isCashoutDocumented(eventType: string, amountUsd: number | null): boolean {
  if (!amountUsd || amountUsd < PROCEEDS_POLICY.MIN_CASHOUT_USD) return false;
  return getCashoutConfidence(eventType) === "documented";
}

/**
 * True if the event should be counted in totalObserved (not totalDocumented).
 */
export function isCashoutObserved(eventType: string, amountUsd: number | null): boolean {
  if (!amountUsd || amountUsd < PROCEEDS_POLICY.MIN_CASHOUT_USD) return false;
  return getCashoutConfidence(eventType) === "observed";
}

/**
 * Human-readable exclusion reason for logging.
 */
export function getExclusionReason(eventType: string, amountUsd: number | null): string {
  if (!amountUsd || amountUsd <= 0) return "zero or null amount";
  if (amountUsd < PROCEEDS_POLICY.MIN_CASHOUT_USD) return `below MIN_CASHOUT_USD ($${PROCEEDS_POLICY.MIN_CASHOUT_USD})`;
  const conf = getCashoutConfidence(eventType);
  if (conf === "observed") return `eventType "${eventType}" is observed, not documented`;
  if (conf === "excluded") return `eventType "${eventType}" is excluded by policy`;
  return "unknown";
}
