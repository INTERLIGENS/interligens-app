// ─── Coverage tier (spec §8.1) ────────────────────────────────────────────
// Pure function. No I/O.
//
// Coverage is about the *quality/completeness of the inputs*, not the
// conclusions. It answers the question: "do we have enough data to
// meaningfully score this subject?"
//
// Signals:
//   • Wash trading input present with ≥ 100 txs   → +1
//   • Cluster input present with ≥ 20 funding edges → +1
//   • Concentration input with ≥ 20 wallet volumes  → +1
//   • Wallet age ≥ 7 days                           → +1 (anti-new-wallet)
//
// Score → tier:
//   4 → high
//   2 or 3 → medium
//   0 or 1 → low

import type { CoverageLevel, ScanRunInput } from "../types";

const MIN_TXS_WASH = 100;
const MIN_FUNDING_EDGES = 20;
const MIN_WALLET_VOLUMES = 20;
const MIN_WALLET_AGE_DAYS = 7;

export function computeCoverage(input: ScanRunInput): CoverageLevel {
  let points = 0;

  if (input.washTrading && input.washTrading.txs.length >= MIN_TXS_WASH) points += 1;
  if (input.cluster && input.cluster.fundingEdges.length >= MIN_FUNDING_EDGES) {
    points += 1;
  }
  if (
    input.concentration &&
    input.concentration.walletVolumes.length >= MIN_WALLET_VOLUMES
  ) {
    points += 1;
  }
  if (
    typeof input.walletAgeDays === "number" &&
    input.walletAgeDays >= MIN_WALLET_AGE_DAYS
  ) {
    points += 1;
  }

  if (points >= 4) return "high";
  if (points >= 2) return "medium";
  return "low";
}

/**
 * Returns a list of reasons why coverage is degraded, useful for UI/logs.
 */
export function coverageReasons(input: ScanRunInput): string[] {
  const reasons: string[] = [];
  if (!input.washTrading) reasons.push("no_wash_trading_input");
  else if (input.washTrading.txs.length < MIN_TXS_WASH) {
    reasons.push(`low_tx_count:${input.washTrading.txs.length}`);
  }
  if (!input.cluster) reasons.push("no_cluster_input");
  else if (input.cluster.fundingEdges.length < MIN_FUNDING_EDGES) {
    reasons.push(`low_funding_edges:${input.cluster.fundingEdges.length}`);
  }
  if (!input.concentration) reasons.push("no_concentration_input");
  else if (input.concentration.walletVolumes.length < MIN_WALLET_VOLUMES) {
    reasons.push(`low_wallet_volumes:${input.concentration.walletVolumes.length}`);
  }
  if (typeof input.walletAgeDays !== "number") reasons.push("wallet_age_unknown");
  else if (input.walletAgeDays < MIN_WALLET_AGE_DAYS) {
    reasons.push(`wallet_age_days:${input.walletAgeDays}`);
  }
  return reasons;
}
