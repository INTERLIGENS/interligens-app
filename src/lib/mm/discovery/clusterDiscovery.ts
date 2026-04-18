// ─── Cluster-based auto-discovery (Phase 9) ──────────────────────────────
// Proactive use of engine/detectors/clusterMapper.ts: starting from the
// known attributed wallets of a given entity, walk the funding graph,
// detect clusters, and surface any member wallet that is NOT already
// attributed. New findings are persisted as MmAttribution rows with
// method=INFERRED_CLUSTER, confidence=0.65 (below the 0.70 review
// threshold — so they never auto-publish), flagged needsReview=true.
//
// Upstream data sources: data/etherscan.ts for EVM chains, data/helius.ts
// for Solana. Both failures are captured and do not abort the whole run.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findClusters } from "../engine/detectors/clusterMapper";
import type { FundingTx, TokenActivity } from "../engine/types";
import type { MmChain } from "../types";
import {
  fetchWalletTransactions,
  type EtherscanFetchOptions,
  type EtherscanTx,
} from "../data/etherscan";
import {
  fetchSolanaTransactions,
  type HeliusFetchOptions,
  type HeliusTx,
} from "../data/helius";
import { writeReviewLog } from "../registry/reviewLog";
import type {
  ClusterSummary,
  DiscoveryOptions,
  DiscoveryResult,
} from "./types";

const DEFAULT_MAX_SEED_WALLETS = 20;
const DEFAULT_MIN_TX_COUNT = 10;
const DEFAULT_CONFIDENCE = 0.65;
const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_MIN_CLUSTER_SIZE = 6;

interface InternalOpts {
  maxSeedWallets: number;
  minTxCount: number;
  confidence: number;
  dryRun: boolean;
  etherscan?: EtherscanFetchOptions;
  helius?: HeliusFetchOptions;
}

function fillDefaults(opts: DiscoveryOptions = {}): InternalOpts {
  return {
    maxSeedWallets: opts.maxSeedWallets ?? DEFAULT_MAX_SEED_WALLETS,
    minTxCount: opts.minTxCount ?? DEFAULT_MIN_TX_COUNT,
    confidence: opts.confidence ?? DEFAULT_CONFIDENCE,
    dryRun: opts.dryRun === true,
  };
}

// ─── Fetch + shape helpers ───────────────────────────────────────────────

async function fetchFundingEvm(
  wallet: string,
  chain: MmChain,
  opts: InternalOpts,
): Promise<{ edges: FundingTx[]; activity: TokenActivity[] }> {
  const txs: EtherscanTx[] = await fetchWalletTransactions(
    wallet,
    chain,
    { limit: 500 },
    opts.etherscan ?? {},
  );
  const edges: FundingTx[] = [];
  const activity: TokenActivity[] = [];
  for (const t of txs) {
    const from = (t.from ?? "").toLowerCase();
    const to = (t.to ?? "").toLowerCase();
    if (!from || !to || from === to) continue;
    const block = Number(t.blockNumber) || 0;
    const timestamp = Number(t.timeStamp) || 0;
    edges.push({
      hash: t.hash,
      from,
      to,
      amountUsd: Number(t.value ?? "0") / 1e18,
      block,
      timestamp,
    });
  }
  // Token activity is built from same-tx counterparty touches: each wallet
  // that transacted with the seed is recorded once per (wallet, "native")
  // pseudo-token so findClusters can require a shared-token edge.
  const seen = new Set<string>();
  for (const e of edges) {
    for (const w of [e.from, e.to]) {
      if (seen.has(w)) continue;
      seen.add(w);
      activity.push({
        wallet: w,
        tokenId: `${chain}:native`,
        firstSeen: e.timestamp,
        lastSeen: e.timestamp,
        totalVolumeUsd: 0,
        txCount: 1,
      });
    }
  }
  return { edges, activity };
}

async function fetchFundingSolana(
  wallet: string,
  opts: InternalOpts,
): Promise<{ edges: FundingTx[]; activity: TokenActivity[] }> {
  const txs: HeliusTx[] = await fetchSolanaTransactions(
    wallet,
    { limit: 100 },
    opts.helius ?? {},
  );
  const edges: FundingTx[] = [];
  const activity: TokenActivity[] = [];
  for (const t of txs) {
    const native = t.nativeTransfers?.[0] ?? null;
    if (!native) continue;
    const from = (native.fromUserAccount ?? "").toLowerCase();
    const to = (native.toUserAccount ?? "").toLowerCase();
    if (!from || !to || from === to) continue;
    edges.push({
      hash: t.signature,
      from,
      to,
      amountUsd: native.amount ?? 0,
      block: t.slot ?? 0,
      timestamp: t.timestamp ?? 0,
    });
  }
  const seen = new Set<string>();
  for (const e of edges) {
    for (const w of [e.from, e.to]) {
      if (seen.has(w)) continue;
      seen.add(w);
      activity.push({
        wallet: w,
        tokenId: "SOLANA:native",
        firstSeen: e.timestamp,
        lastSeen: e.timestamp,
        totalVolumeUsd: 0,
        txCount: 1,
      });
    }
  }
  return { edges, activity };
}

// ─── Per-wallet activity gate ────────────────────────────────────────────
// A discovered wallet must have sufficient on-chain life to be worth
// flagging. We count inbound + outbound edges from the fetched window.

function walletActivityCount(
  wallet: string,
  edges: FundingTx[],
): number {
  let count = 0;
  for (const e of edges) {
    if (e.from === wallet || e.to === wallet) count += 1;
  }
  return count;
}

// ─── Main entry point ────────────────────────────────────────────────────

export async function discoverNewWallets(
  entitySlug: string,
  optsIn: DiscoveryOptions = {},
): Promise<DiscoveryResult> {
  const opts = fillDefaults(optsIn);
  const result: DiscoveryResult = {
    entitySlug,
    walletsTested: 0,
    newWalletsFound: 0,
    attributionsCreated: 0,
    errors: [],
    clusters: [],
  };

  const entity = await prisma.mmEntity.findUnique({
    where: { slug: entitySlug },
    select: { id: true, slug: true },
  });
  if (!entity) {
    result.errors.push({
      seedWallet: "",
      message: `entity ${entitySlug} not found`,
    });
    return result;
  }

  // Load the highest-confidence attributions first. Solana and EVM rows are
  // processed with the appropriate data-layer client.
  const seeds = await prisma.mmAttribution.findMany({
    where: {
      mmEntityId: entity.id,
      revokedAt: null,
    },
    orderBy: { confidence: "desc" },
    take: opts.maxSeedWallets,
    select: {
      walletAddress: true,
      chain: true,
    },
  });

  // A discovered wallet is "new" iff it is not already attributed to this
  // entity on the same chain. We pre-load the full active set once.
  const attributedSet = new Set<string>();
  const allAttribs = await prisma.mmAttribution.findMany({
    where: {
      mmEntityId: entity.id,
      revokedAt: null,
    },
    select: {
      walletAddress: true,
      chain: true,
    },
  });
  for (const a of allAttribs) {
    attributedSet.add(`${a.walletAddress.toLowerCase()}:${a.chain}`);
  }

  for (const seed of seeds) {
    const chain = seed.chain as MmChain;
    const seedWalletLc = seed.walletAddress.toLowerCase();
    result.walletsTested += 1;

    let edges: FundingTx[] = [];
    let activity: TokenActivity[] = [];
    try {
      const data =
        chain === "SOLANA"
          ? await fetchFundingSolana(seedWalletLc, opts)
          : await fetchFundingEvm(seedWalletLc, chain, opts);
      edges = data.edges;
      activity = data.activity;
    } catch (err) {
      result.errors.push({
        seedWallet: seedWalletLc,
        message: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    if (edges.length === 0) continue;

    const clusters = findClusters({
      targetWallet: seedWalletLc,
      chain,
      fundingEdges: edges,
      tokenActivity: activity,
      maxDepth: DEFAULT_MAX_DEPTH,
      minClusterSize: DEFAULT_MIN_CLUSTER_SIZE,
    });
    if (clusters.length === 0) continue;

    for (const c of clusters) {
      const candidates = c.memberWallets.filter(
        (w) =>
          w !== seedWalletLc &&
          !attributedSet.has(`${w}:${chain}`) &&
          walletActivityCount(w, edges) >= opts.minTxCount,
      );
      if (candidates.length === 0) continue;

      const summary: ClusterSummary = {
        internalClusterId: c.internalClusterId,
        seedWallet: seedWalletLc,
        seedChain: chain,
        memberCount: c.memberWallets.length,
        sharedTokens: c.sharedTokens,
        proximityScore: c.proximityScore,
        newWallets: candidates,
      };
      result.clusters.push(summary);
      result.newWalletsFound += candidates.length;

      if (opts.dryRun) continue;

      for (const newWallet of candidates) {
        try {
          const created = await prisma.mmAttribution.create({
            data: {
              walletAddress: newWallet,
              chain,
              mmEntityId: entity.id,
              attributionMethod: "INFERRED_CLUSTER",
              confidence: Math.min(0.7, opts.confidence),
              evidenceRefs: [
                {
                  source: "cluster_discovery",
                  seedWallet: seedWalletLc,
                  internalClusterId: c.internalClusterId,
                  sharedTokens: c.sharedTokens,
                  proximityScore: c.proximityScore,
                },
              ] as unknown as Prisma.InputJsonValue,
              reviewerUserId: null,
              challengeReason: "needsReview=true (auto-discovered)",
            },
          });
          await writeReviewLog({
            targetType: "ATTRIBUTION",
            targetId: created.id,
            action: "CREATED",
            actorUserId: "system",
            actorRole: "cluster_discovery",
            notes: `auto-discovered via cluster ${c.internalClusterId} from seed ${seedWalletLc}`,
            snapshotAfter: {
              walletAddress: newWallet,
              chain,
              entitySlug: entity.slug,
              internalClusterId: c.internalClusterId,
              confidence: Math.min(0.7, opts.confidence),
              needsReview: true,
            } as unknown as Prisma.InputJsonValue,
          });
          attributedSet.add(`${newWallet}:${chain}`);
          result.attributionsCreated += 1;
        } catch (err) {
          result.errors.push({
            seedWallet: seedWalletLc,
            message: `failed to persist ${newWallet}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          });
        }
      }
    }
  }

  return result;
}
