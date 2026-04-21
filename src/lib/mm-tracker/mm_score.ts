/**
 * MMScore — aggregates wash, cluster, and registry signals into a single
 * 0..100 score with a CLEAN/SUSPICIOUS/MANIPULATED verdict.
 *
 * Pure function. Upstream code is responsible for fetching transfers,
 * funding events, and wallet sets (typically via Helius for SOL).
 */

import { computeWashScore, type WashResult, type WashTransfer } from "./wash_detector";
import { mapClusters, type ClusterMapResult, type FundingEvent } from "./cluster_mapper";
import { findMMWallet, hasKnownMMWallet, type MMChain } from "./mm_wallet_registry";

export type MMVerdict = "CLEAN" | "SUSPICIOUS" | "MANIPULATED";

export interface MMDriver {
  id: string;
  label: string;
  severity: "low" | "med" | "high" | "critical";
  delta: number;
  why: string;
}

export interface MMScoreInput {
  chain: MMChain;
  target: string;
  /** Recent transfers for the wash detector. */
  transfers: WashTransfer[];
  /** Recent funding events for the cluster mapper. */
  fundingEvents: FundingEvent[];
  /** Other wallets trading the same target, used for clustering. */
  relatedWallets: string[];
}

export interface MMScoreResult {
  mmScore: number;
  verdict: MMVerdict;
  drivers: MMDriver[];
  wash: WashResult;
  cluster: ClusterMapResult;
  knownMMHit: { address: string; desk: string; confidence: string } | null;
  /** Human-readable signals for the UI badge. */
  signals: string[];
  signalsFr: string[];
}

/**
 * Fuse three sub-signals into a single 0..100 score.
 *
 * Weights:
 *   wash    — up to 55 pts
 *   cluster — up to 35 pts
 *   registry hit — +35 pts at HIGH/MEDIUM
 *
 * Verdict buckets:
 *   MANIPULATED   ≥70
 *   SUSPICIOUS    ≥40
 *   CLEAN         <40
 */
export function computeMMScore(input: MMScoreInput): MMScoreResult {
  const drivers: MMDriver[] = [];
  const signals: string[] = [];
  const signalsFr: string[] = [];

  const wash = computeWashScore(input.transfers);
  const cluster = mapClusters([input.target, ...input.relatedWallets], input.fundingEvents);

  // ── Wash contribution ────────────────────────────────────────────────
  const washContribution = Math.round(wash.washScore * 0.55);
  if (wash.washScore >= 70) {
    drivers.push({
      id: "wash_high",
      label: "Heavy wash-trading pattern",
      severity: "high",
      delta: washContribution,
      why: `washScore=${wash.washScore} — ${wash.reasons.slice(0, 2).join(", ")}`,
    });
    signals.push("Heavy wash-trading pattern detected");
    signalsFr.push("Forte activité de wash trading détectée");
  } else if (wash.washScore >= 40) {
    drivers.push({
      id: "wash_medium",
      label: "Wash-trading signals",
      severity: "med",
      delta: washContribution,
      why: `washScore=${wash.washScore} — ${wash.reasons.slice(0, 2).join(", ")}`,
    });
    signals.push("Wash-trading signals present");
    signalsFr.push("Signaux de wash trading présents");
  }

  // ── Cluster contribution ─────────────────────────────────────────────
  if (cluster.maxClusterSize >= 5) {
    drivers.push({
      id: "cluster_large",
      label: `Large funding cluster (${cluster.maxClusterSize} wallets)`,
      severity: "high",
      delta: 35,
      why: `${cluster.maxClusterSize} wallets share a common funding source`,
    });
    signals.push(`${cluster.maxClusterSize} wallets share a funding source`);
    signalsFr.push(`${cluster.maxClusterSize} wallets partagent une source de financement`);
  } else if (cluster.maxClusterSize >= 3) {
    drivers.push({
      id: "cluster_small",
      label: `Funding cluster (${cluster.maxClusterSize} wallets)`,
      severity: "med",
      delta: 20,
      why: `${cluster.maxClusterSize} wallets share a common funding source`,
    });
    signals.push(`${cluster.maxClusterSize} wallets share a funding source`);
    signalsFr.push(`${cluster.maxClusterSize} wallets partagent une source de financement`);
  }

  // ── Registry hit ─────────────────────────────────────────────────────
  const direct = findMMWallet(input.chain, input.target);
  let knownMMHit: MMScoreResult["knownMMHit"] = null;
  if (direct && direct.confidence !== "LOW") {
    knownMMHit = { address: direct.address, desk: direct.desk, confidence: direct.confidence };
    drivers.push({
      id: "mm_registry_direct",
      label: `Known MM desk: ${direct.desk}`,
      severity: "high",
      delta: 35,
      why: `Address matches ${direct.desk} registry entry (${direct.label})`,
    });
    signals.push(`Known ${direct.desk} market-making wallet`);
    signalsFr.push(`Wallet de market-making connu (${direct.desk})`);
  } else if (hasKnownMMWallet(input.chain, input.relatedWallets)) {
    drivers.push({
      id: "mm_registry_related",
      label: "Related wallet matches MM registry",
      severity: "med",
      delta: 15,
      why: "One of the related trading wallets is a known MM desk",
    });
    signals.push("Known MM wallet in related trading set");
    signalsFr.push("Wallet MM connu dans l'ensemble de trading associé");
  }

  // ── Aggregate ─────────────────────────────────────────────────────────
  const rawScore = drivers.reduce((s, d) => s + d.delta, 0);
  const mmScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  const verdict: MMVerdict = mmScore >= 70 ? "MANIPULATED" : mmScore >= 40 ? "SUSPICIOUS" : "CLEAN";

  // Intentionally leave `signals` empty when nothing fires. MMScoreBadge
  // treats an empty signals array as "render nothing" — surfacing a "no
  // manipulation detected" copy would be accusatory in either direction.

  return { mmScore, verdict, drivers, wash, cluster, knownMMHit, signals, signalsFr };
}
