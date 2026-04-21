// ─── Cohort key builder (spec §7.6) ───────────────────────────────────────
// Pure function. No I/O.
//
// A cohort key groups subjects whose P99 percentiles should be computed
// against each other. Format: "<chain>:<liquidityTier>:<ageBucket>".

import type { MmChain } from "../../types";

export type LiquidityTier = "micro" | "small" | "mid" | "large";
export type AgeBucket = "new" | "fresh" | "established" | "mature";

const CHAIN_TAG: Record<MmChain, string> = {
  SOLANA: "sol",
  ETHEREUM: "eth",
  BASE: "base",
  ARBITRUM: "arb",
  OPTIMISM: "op",
  BNB: "bnb",
  POLYGON: "poly",
};

export function liquidityTierOf(liquidityUsd: number): LiquidityTier {
  if (liquidityUsd < 100_000) return "micro";
  if (liquidityUsd < 1_000_000) return "small";
  if (liquidityUsd < 10_000_000) return "mid";
  return "large";
}

export function ageBucketOf(ageDays: number): AgeBucket {
  if (ageDays < 7) return "new";
  if (ageDays < 30) return "fresh";
  if (ageDays < 180) return "established";
  return "mature";
}

export interface CohortKeyInput {
  chain: MmChain;
  ageDays: number;
  liquidityUsd: number;
}

export function cohortKey(input: CohortKeyInput): string {
  const c = CHAIN_TAG[input.chain];
  const lt = liquidityTierOf(input.liquidityUsd);
  const ab = ageBucketOf(input.ageDays);
  return `${c}:${lt}:${ab}`;
}

/**
 * Fallback to the parent cohort when the base cohort is under-populated
 * (spec §7.6). Strategy: drop the age bucket first, then the liquidity
 * tier. Returns null when we have fallen back to just the chain.
 */
export function parentCohortKey(key: string): string | null {
  const parts = key.split(":");
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join(":");
}
