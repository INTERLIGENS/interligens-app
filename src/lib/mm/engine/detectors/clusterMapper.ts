// ─── Cluster Coordination Detector (core, spec §7.2) ──────────────────────
// Pure function. No I/O.
//
// Algorithm:
//   1. From the target wallet, walk the funding graph *backward* (to → from)
//      for up to `maxDepth` hops. Any wallet reachable this way is a
//      potential funding ancestor.
//   2. Also walk *forward* from each ancestor (from → to) up to `maxDepth`
//      hops to discover other wallets fed from the same ancestor.
//   3. For every root candidate, collect its descendants that have traded
//      on at least one shared token with the target. If the descendant set
//      (including the target) exceeds `minClusterSize`, declare a cluster.
//   4. Each cluster receives an anonymous `internalClusterId` = sha256 over
//      the sorted member wallets. The detector never emits an entity name.
//   5. Temporal proximity weighting:
//        < 1 h   → score HIGH (1.0)
//        < 24 h  → score MEDIUM (0.6)
//        < 7 d   → score LOW    (0.3)
//        ≥ 7 d   → ignored for temporal bonus
//
// Output contribution (max 25 pts):
//   CLUSTER_DETECTED     : 12 pts if at least one cluster of size ≥ threshold
//   TEMPORAL_TIGHT       : +9 pts if proximityScore ≥ 0.8
//   MULTI_TOKEN          : +4 pts if cluster shares ≥ 2 tokens

import { createHash } from "node:crypto";
import type {
  Cluster,
  ClusterInput,
  DetectorOutput,
  DetectorSignal,
  FundingTx,
  TokenActivity,
} from "../types";
import { CLUSTER_SUBSIGNAL_POINTS } from "../scoring/weights";

const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_MIN_CLUSTER_SIZE = 6; // spec: "plus de 5 wallets" => > 5

const HOUR = 3_600;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

// ─── Graph helpers ─────────────────────────────────────────────────────────

function buildAdjacency(edges: FundingTx[]): {
  outgoing: Map<string, FundingTx[]>;
  incoming: Map<string, FundingTx[]>;
} {
  const outgoing = new Map<string, FundingTx[]>();
  const incoming = new Map<string, FundingTx[]>();
  for (const e of edges) {
    const out = outgoing.get(e.from) ?? [];
    out.push(e);
    outgoing.set(e.from, out);
    const inc = incoming.get(e.to) ?? [];
    inc.push(e);
    incoming.set(e.to, inc);
  }
  return { outgoing, incoming };
}

function ancestors(
  target: string,
  incoming: Map<string, FundingTx[]>,
  maxDepth: number,
): Map<string, { depth: number; earliestFunding: number }> {
  const out = new Map<string, { depth: number; earliestFunding: number }>();
  const queue: Array<{ wallet: string; depth: number }> = [{ wallet: target, depth: 0 }];
  const visited = new Set<string>([target]);
  while (queue.length > 0) {
    const { wallet, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    const inc = incoming.get(wallet) ?? [];
    for (const edge of inc) {
      const existing = out.get(edge.from);
      if (!existing || edge.timestamp < existing.earliestFunding) {
        out.set(edge.from, {
          depth: depth + 1,
          earliestFunding: edge.timestamp,
        });
      }
      if (!visited.has(edge.from)) {
        visited.add(edge.from);
        queue.push({ wallet: edge.from, depth: depth + 1 });
      }
    }
  }
  return out;
}

function descendants(
  root: string,
  outgoing: Map<string, FundingTx[]>,
  maxDepth: number,
): Map<string, { depth: number; fundedAt: number }> {
  const out = new Map<string, { depth: number; fundedAt: number }>();
  const queue: Array<{ wallet: string; depth: number }> = [{ wallet: root, depth: 0 }];
  const visited = new Set<string>([root]);
  while (queue.length > 0) {
    const { wallet, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    const outs = outgoing.get(wallet) ?? [];
    for (const edge of outs) {
      const existing = out.get(edge.to);
      if (!existing || edge.timestamp < existing.fundedAt) {
        out.set(edge.to, {
          depth: depth + 1,
          fundedAt: edge.timestamp,
        });
      }
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push({ wallet: edge.to, depth: depth + 1 });
      }
    }
  }
  return out;
}

// ─── Token activity helpers ────────────────────────────────────────────────

function tokensByWallet(activity: TokenActivity[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const a of activity) {
    const set = out.get(a.wallet) ?? new Set<string>();
    set.add(a.tokenId);
    out.set(a.wallet, set);
  }
  return out;
}

function sharedTokens(
  members: string[],
  byWallet: Map<string, Set<string>>,
): string[] {
  if (members.length === 0) return [];
  // A shared token means at least 2 members traded it (spec: funding graph
  // descendants that both traded on the same token).
  const count = new Map<string, number>();
  for (const m of members) {
    const tokens = byWallet.get(m);
    if (!tokens) continue;
    for (const t of tokens) {
      count.set(t, (count.get(t) ?? 0) + 1);
    }
  }
  const shared: string[] = [];
  for (const [token, n] of count) {
    if (n >= 2) shared.push(token);
  }
  return shared.sort();
}

// ─── Proximity scoring ─────────────────────────────────────────────────────

function proximityScore(fundingTimes: number[]): number {
  if (fundingTimes.length < 2) return 0;
  const sorted = [...fundingTimes].sort((a, b) => a - b);
  const span = sorted[sorted.length - 1] - sorted[0];
  if (span <= HOUR) return 1;
  if (span <= DAY) return 0.6;
  if (span <= WEEK) return 0.3;
  return 0;
}

// ─── Anonymous cluster ID ──────────────────────────────────────────────────

export function internalClusterIdFor(members: string[]): string {
  const sorted = [...members].map((m) => m.toLowerCase()).sort();
  const hash = createHash("sha256").update(sorted.join("|")).digest("hex");
  return `cluster_${hash.slice(0, 16)}`;
}

// ─── Public: raw cluster search (used by tests and the detector) ──────────

export function findClusters(input: ClusterInput): Cluster[] {
  const maxDepth = input.maxDepth ?? DEFAULT_MAX_DEPTH;
  const cohortP99 = input.percentiles?.metrics?.clusterSize?.p99;
  // When a caller passes percentiles, use the cohort P99 as the minimum
  // unusual-cluster size unless the caller also explicitly set minClusterSize
  // (explicit override wins).
  const minSize =
    input.minClusterSize ??
    (typeof cohortP99 === "number" && cohortP99 > 0
      ? Math.max(DEFAULT_MIN_CLUSTER_SIZE, Math.ceil(cohortP99))
      : DEFAULT_MIN_CLUSTER_SIZE);
  const { outgoing, incoming } = buildAdjacency(input.fundingEdges);
  const byWallet = tokensByWallet(input.tokenActivity);
  const targetTokens = byWallet.get(input.targetWallet) ?? new Set<string>();

  const roots = ancestors(input.targetWallet, incoming, maxDepth);
  const clusters: Cluster[] = [];
  const seenClusterIds = new Set<string>();

  // Include the target itself as a degenerate root case (useful when target
  // *is* the root, or when no ancestor exists but many sibling wallets were
  // funded by it).
  const rootCandidates = new Set<string>([input.targetWallet, ...roots.keys()]);

  for (const root of rootCandidates) {
    const desc = descendants(root, outgoing, maxDepth);
    const members = new Set<string>([input.targetWallet, ...desc.keys()]);
    if (!members.has(root)) {
      // target's ancestor may also be a member if it trades the same token.
      if (byWallet.has(root) || root === input.targetWallet) members.add(root);
    }

    // Filter members to those with at least one token in common with target
    // (or, if target has no token activity, require at least two members
    // sharing any single token).
    const filtered: string[] = [];
    for (const m of members) {
      const t = byWallet.get(m);
      if (!t) continue;
      if (targetTokens.size === 0) {
        // no target-specific filter, keep any wallet with activity
        filtered.push(m);
        continue;
      }
      let overlaps = false;
      for (const tok of t) {
        if (targetTokens.has(tok)) {
          overlaps = true;
          break;
        }
      }
      if (overlaps || m === input.targetWallet) filtered.push(m);
    }

    if (filtered.length < minSize) continue;

    const shared = sharedTokens(filtered, byWallet);
    if (shared.length === 0) continue;

    const fundingTimes: number[] = [];
    for (const m of filtered) {
      const d = desc.get(m);
      if (d) fundingTimes.push(d.fundedAt);
    }

    const clusterId = internalClusterIdFor(filtered);
    if (seenClusterIds.has(clusterId)) continue;
    seenClusterIds.add(clusterId);

    clusters.push({
      internalClusterId: clusterId,
      rootWallet: root,
      memberWallets: [...filtered].sort(),
      sharedTokens: shared,
      proximityScore: proximityScore(fundingTimes),
      earliestFunding: fundingTimes.length ? Math.min(...fundingTimes) : 0,
      latestFunding: fundingTimes.length ? Math.max(...fundingTimes) : 0,
    });
  }

  return clusters;
}

// ─── Public entry point ────────────────────────────────────────────────────

export function runClusterDetector(input: ClusterInput): DetectorOutput {
  const started = performance.now();

  const clusters = findClusters(input);
  const signals: DetectorSignal[] = [];
  let score = 0;

  if (clusters.length > 0) {
    const top = clusters.reduce((a, b) =>
      b.memberWallets.length > a.memberWallets.length ? b : a,
    );
    signals.push({
      type: "CLUSTER_DETECTED",
      severity: top.memberWallets.length >= 10 ? "HIGH" : "MEDIUM",
      metric: top.memberWallets.length,
      description:
        `Anonymous funding cluster of ${top.memberWallets.length} wallets ` +
        `sharing ${top.sharedTokens.length} token(s).`,
      extra: {
        internalClusterId: top.internalClusterId,
        memberCount: top.memberWallets.length,
        sharedTokens: top.sharedTokens,
        proximityScore: top.proximityScore,
      },
    });
    score += CLUSTER_SUBSIGNAL_POINTS.CLUSTER_DETECTED;

    if (top.proximityScore >= 0.8) {
      signals.push({
        type: "TEMPORAL_TIGHT",
        severity: "HIGH",
        metric: top.proximityScore,
        description: "Cluster members were funded within the same hour — strong coordination proxy.",
      });
      score += CLUSTER_SUBSIGNAL_POINTS.TEMPORAL_TIGHT;
    }

    if (top.sharedTokens.length >= 2) {
      signals.push({
        type: "MULTI_TOKEN",
        severity: "MEDIUM",
        metric: top.sharedTokens.length,
        description: "Cluster members transacted on more than one shared token.",
      });
      score += CLUSTER_SUBSIGNAL_POINTS.MULTI_TOKEN;
    }
  }

  const maxScore = 25;
  score = Math.min(score, maxScore);

  return {
    detectorType: "CLUSTER_COORDINATION",
    score,
    maxScore,
    signals,
    evidence: {
      chain: input.chain,
      targetWallet: input.targetWallet,
      minClusterSizeUsed:
        input.minClusterSize ??
        (input.percentiles?.metrics?.clusterSize?.p99 ?? DEFAULT_MIN_CLUSTER_SIZE),
      cohortKey: input.percentiles?.cohortKey ?? null,
      clusterCount: clusters.length,
      topCluster: clusters[0]
        ? {
            internalClusterId: clusters[0].internalClusterId,
            memberCount: clusters[0].memberWallets.length,
            sharedTokens: clusters[0].sharedTokens,
            proximityScore: clusters[0].proximityScore,
          }
        : null,
      // Full member lists are kept in evidence for investigator review but
      // never in signals (signals are user-facing summaries).
      clusters: clusters.map((c) => ({
        internalClusterId: c.internalClusterId,
        rootWallet: c.rootWallet,
        memberCount: c.memberWallets.length,
        members: c.memberWallets,
        sharedTokens: c.sharedTokens,
        proximityScore: c.proximityScore,
      })),
    },
    durationMs: Math.max(0, Math.round(performance.now() - started)),
  };
}
