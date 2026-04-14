/**
 * Cluster mapper.
 *
 * Given a set of wallets and their funding events, groups wallets that
 * share the same funding source. Pure, deterministic, no network / DB.
 *
 * Used by mm_score.ts: if N wallets trading the target asset are all
 * funded by the same source, that's a strong coordinated-MM signal.
 */

export interface FundingEvent {
  /** Wallet that received the funds. */
  wallet: string;
  /** Wallet / program that sent them. Lowercased for EVM, preserved for SOL. */
  source: string;
  /** Amount — used only for a weak tiebreaker, cluster detection is membership-based. */
  amount?: number;
  timestamp?: number;
}

export interface Cluster {
  sourceAddress: string;
  wallets: string[];
  firstSeen?: number;
  lastSeen?: number;
}

export interface ClusterMapResult {
  clusters: Cluster[];
  /** Wallets that did NOT share a funding source with any other wallet in input. */
  orphans: string[];
  /** Biggest cluster size — used downstream as a fast boolean signal. */
  maxClusterSize: number;
}

function norm(s: string): string {
  const t = s.trim();
  if (t.startsWith("0x") && t.length === 42) return t.toLowerCase();
  return t;
}

/**
 * Build clusters by common funding source.
 *
 * A cluster is any funding source that funded ≥2 distinct wallets from the
 * input set. Wallets funded from a source only they use end up in `orphans`.
 * The single biggest cluster size is reported at the top level so callers
 * can short-circuit without iterating.
 */
export function mapClusters(
  targetWallets: string[],
  fundingEvents: FundingEvent[],
): ClusterMapResult {
  const targetSet = new Set(targetWallets.map(norm));
  const bySource = new Map<string, { wallets: Set<string>; first?: number; last?: number }>();

  for (const ev of fundingEvents) {
    const w = norm(ev.wallet);
    if (!targetSet.has(w)) continue;
    const src = norm(ev.source);
    if (!src) continue;

    const bucket = bySource.get(src) ?? { wallets: new Set<string>() };
    bucket.wallets.add(w);
    if (ev.timestamp !== undefined) {
      bucket.first = bucket.first === undefined ? ev.timestamp : Math.min(bucket.first, ev.timestamp);
      bucket.last = bucket.last === undefined ? ev.timestamp : Math.max(bucket.last, ev.timestamp);
    }
    bySource.set(src, bucket);
  }

  const clusters: Cluster[] = [];
  const clustered = new Set<string>();

  for (const [src, bucket] of bySource) {
    if (bucket.wallets.size >= 2) {
      clusters.push({
        sourceAddress: src,
        wallets: Array.from(bucket.wallets).sort(),
        firstSeen: bucket.first,
        lastSeen: bucket.last,
      });
      for (const w of bucket.wallets) clustered.add(w);
    }
  }

  clusters.sort((a, b) => b.wallets.length - a.wallets.length);

  const orphans = Array.from(targetSet).filter((w) => !clustered.has(w)).sort();
  const maxClusterSize = clusters.length > 0 ? clusters[0].wallets.length : 0;

  return { clusters, orphans, maxClusterSize };
}
