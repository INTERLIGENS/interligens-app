// ─── Cluster-based auto-discovery types (Phase 9) ────────────────────────
// Shapes returned by src/lib/mm/discovery/clusterDiscovery.ts so callers
// (CLI scripts, admin dashboards) can type-check the results without
// depending on Prisma return types.

import type { MmChain } from "../types";

export interface ClusterSummary {
  /**
   * Anonymous cluster id from engine/detectors/clusterMapper.ts. Never
   * references a named entity — that mapping happens through the Registry.
   */
  internalClusterId: string;
  seedWallet: string;
  seedChain: MmChain;
  memberCount: number;
  sharedTokens: string[];
  proximityScore: number;
  newWallets: string[];
}

export interface DiscoveryResult {
  entitySlug: string;
  walletsTested: number;
  newWalletsFound: number;
  attributionsCreated: number;
  errors: Array<{ seedWallet: string; message: string }>;
  clusters: ClusterSummary[];
}

export interface DiscoveryOptions {
  /**
   * Maximum number of seed wallets to walk. Default 20.
   */
  maxSeedWallets?: number;
  /**
   * Minimum transaction count for a discovered wallet to be persisted.
   * Default 10.
   */
  minTxCount?: number;
  /**
   * Confidence stamped on the new MmAttribution rows. Default 0.65 (below
   * the 0.70 review threshold — needs human review before publication).
   */
  confidence?: number;
  /**
   * Dry-run — return the result without persisting. Default false.
   */
  dryRun?: boolean;
  /**
   * Now() override for deterministic tests.
   */
  nowSeconds?: number;
}
