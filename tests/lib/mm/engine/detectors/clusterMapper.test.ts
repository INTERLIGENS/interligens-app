import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  findClusters,
  internalClusterIdFor,
  runClusterDetector,
} from "@/lib/mm/engine/detectors/clusterMapper";
import type { ClusterInput, FundingTx } from "@/lib/mm/engine/types";
import { gotbitLikeCluster } from "../../fixtures/generate";

const FIXTURE_DIR = join(process.cwd(), "tests", "lib", "mm", "fixtures");
const loadJson = <T>(f: string): T =>
  JSON.parse(readFileSync(join(FIXTURE_DIR, f), "utf-8")) as T;

const ts = 1_700_000_000;

describe("internalClusterIdFor", () => {
  it("is deterministic across member ordering", () => {
    const a = internalClusterIdFor(["X", "Y", "Z"]);
    const b = internalClusterIdFor(["Z", "X", "Y"]);
    const c = internalClusterIdFor(["x", "y", "z"]);
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it("produces anonymous cluster_<hex> identifiers", () => {
    const id = internalClusterIdFor(["A", "B"]);
    expect(id).toMatch(/^cluster_[a-f0-9]{16}$/);
  });
});

describe("findClusters", () => {
  it("returns empty on an isolated wallet with no shared funding", () => {
    const input: ClusterInput = {
      targetWallet: "lone",
      chain: "SOLANA",
      fundingEdges: [],
      tokenActivity: [
        { wallet: "lone", tokenId: "T", firstSeen: ts, lastSeen: ts + 10, totalVolumeUsd: 100, txCount: 1 },
      ],
    };
    expect(findClusters(input)).toEqual([]);
  });

  it("detects a simple root-funded cluster of 6+ wallets on a shared token", () => {
    const fx = gotbitLikeCluster({ descendantCount: 8 });
    const clusters = findClusters(fx);
    expect(clusters.length).toBeGreaterThanOrEqual(1);
    const big = clusters.reduce((a, b) =>
      b.memberWallets.length > a.memberWallets.length ? b : a,
    );
    expect(big.memberWallets.length).toBeGreaterThanOrEqual(6);
    expect(big.sharedTokens.length).toBeGreaterThanOrEqual(1);
  });

  it("respects minClusterSize threshold", () => {
    const fx = gotbitLikeCluster({ descendantCount: 4 });
    const clusters = findClusters({ ...fx, minClusterSize: 6 });
    expect(clusters).toEqual([]);
  });

  it("walks up to 3 funding levels (spec default)", () => {
    // target ← mid ← root, 5 other descendants share the same root through mid
    const root = "root";
    const mid = "mid";
    const target = "target";
    const descendants = Array.from({ length: 6 }, (_, i) => `d-${i}`);
    const edges: FundingTx[] = [
      { hash: "e1", from: root, to: mid, amountUsd: 100, block: 1, timestamp: ts },
      { hash: "e2", from: mid, to: target, amountUsd: 100, block: 2, timestamp: ts + 60 },
    ];
    descendants.forEach((d, i) =>
      edges.push({
        hash: `e-${i}`,
        from: mid,
        to: d,
        amountUsd: 100,
        block: 3 + i,
        timestamp: ts + 120 + i * 30,
      }),
    );
    const activity = [target, ...descendants].map((w) => ({
      wallet: w,
      tokenId: "TGT",
      firstSeen: ts + 200,
      lastSeen: ts + 500,
      totalVolumeUsd: 1_000,
      txCount: 2,
    }));
    const clusters = findClusters({
      targetWallet: target,
      chain: "SOLANA",
      fundingEdges: edges,
      tokenActivity: activity,
    });
    expect(clusters.length).toBeGreaterThan(0);
    const all = clusters.flatMap((c) => c.memberWallets);
    expect(new Set(all).size).toBeGreaterThanOrEqual(7); // target + 6 descendants
  });

  it("assigns a tight proximity score when funding is within an hour", () => {
    const fx = gotbitLikeCluster({ descendantCount: 8, baseTs: ts });
    const clusters = findClusters(fx);
    const big = clusters.reduce((a, b) =>
      b.memberWallets.length > a.memberWallets.length ? b : a,
    );
    expect(big.proximityScore).toBeGreaterThanOrEqual(0.6);
  });

  it("never emits an entity name", () => {
    const fx = gotbitLikeCluster({ descendantCount: 8 });
    const clusters = findClusters(fx);
    for (const c of clusters) {
      expect(c.internalClusterId.startsWith("cluster_")).toBe(true);
      expect((c as unknown as { entity?: unknown }).entity).toBeUndefined();
      expect((c as unknown as { entityId?: unknown }).entityId).toBeUndefined();
    }
  });
});

describe("runClusterDetector (integrated)", () => {
  it("loads the gotbit-cluster fixture and scores ≥12", () => {
    const fx = loadJson<ClusterInput>("gotbit-cluster.json");
    const out = runClusterDetector(fx);
    expect(out.score).toBeGreaterThanOrEqual(12);
    expect(out.maxScore).toBe(25);
    const types = out.signals.map((s) => s.type);
    expect(types).toContain("CLUSTER_DETECTED");
  });

  it("caps at maxScore = 25", () => {
    const fx = gotbitLikeCluster({ descendantCount: 12 });
    const out = runClusterDetector(fx);
    expect(out.score).toBeLessThanOrEqual(25);
  });

  it("returns 0 on an empty funding graph", () => {
    const out = runClusterDetector({
      targetWallet: "lone",
      chain: "SOLANA",
      fundingEdges: [],
      tokenActivity: [],
    });
    expect(out.score).toBe(0);
    expect(out.signals).toEqual([]);
  });

  it("evidence exposes anonymous cluster ids only", () => {
    const fx = gotbitLikeCluster({ descendantCount: 8 });
    const out = runClusterDetector(fx);
    const evid = out.evidence as { clusters: Array<{ internalClusterId: string }> };
    for (const c of evid.clusters) {
      expect(c.internalClusterId).toMatch(/^cluster_[a-f0-9]{16}$/);
    }
  });
});
