import { describe, it, expect } from "vitest";
import { computeWashScore } from "../wash_detector";
import { mapClusters } from "../cluster_mapper";
import { computeMMScore } from "../mm_score";

describe("wash_detector", () => {
  it("flags concentrated wash patterns", () => {
    const transfers = Array.from({ length: 60 }, (_, i) => ({
      counterparty: i < 50 ? "A" : i < 55 ? "B" : `C${i}`,
      amount: 100,
      timestamp: i,
    }));
    const res = computeWashScore(transfers);
    expect(res.washScore).toBeGreaterThanOrEqual(70);
    expect(res.topCounterpartyShare).toBeGreaterThan(0.7);
  });

  it("returns clean score for diverse counterparties", () => {
    const transfers = Array.from({ length: 80 }, (_, i) => ({
      counterparty: `unique_${i}`,
      amount: 100,
      timestamp: i,
    }));
    const res = computeWashScore(transfers);
    expect(res.washScore).toBeLessThan(20);
  });

  it("caps score when sample is too small", () => {
    const transfers = Array.from({ length: 8 }, () => ({
      counterparty: "A",
      amount: 100,
      timestamp: 0,
    }));
    const res = computeWashScore(transfers);
    expect(res.washScore).toBeLessThanOrEqual(30);
    expect(res.reasons.some((r) => r.startsWith("small_sample"))).toBe(true);
  });

  it("handles empty input without throwing", () => {
    expect(computeWashScore([]).washScore).toBe(0);
  });
});

describe("cluster_mapper", () => {
  it("groups wallets sharing a funding source", () => {
    const res = mapClusters(
      ["w1", "w2", "w3", "w4"],
      [
        { wallet: "w1", source: "funderA" },
        { wallet: "w2", source: "funderA" },
        { wallet: "w3", source: "funderA" },
        { wallet: "w4", source: "funderB" },
      ],
    );
    expect(res.clusters.length).toBe(1);
    expect(res.clusters[0].wallets).toHaveLength(3);
    expect(res.orphans).toContain("w4");
    expect(res.maxClusterSize).toBe(3);
  });

  it("returns zero clusters for independent wallets", () => {
    const res = mapClusters(
      ["w1", "w2"],
      [
        { wallet: "w1", source: "funderA" },
        { wallet: "w2", source: "funderB" },
      ],
    );
    expect(res.clusters).toHaveLength(0);
    expect(res.maxClusterSize).toBe(0);
  });
});

describe("mm_score", () => {
  it("reports MANIPULATED on heavy wash + cluster", () => {
    const transfers = Array.from({ length: 60 }, (_, i) => ({
      counterparty: i < 50 ? "partnerA" : "partnerB",
      amount: 100,
      timestamp: i,
    }));
    const related = ["w1", "w2", "w3", "w4", "w5"];
    const fundingEvents = related.map((w) => ({ wallet: w, source: "sharedFunder" }));
    const res = computeMMScore({
      chain: "SOL",
      target: "target",
      transfers,
      fundingEvents,
      relatedWallets: related,
    });
    expect(res.verdict).toBe("MANIPULATED");
    expect(res.mmScore).toBeGreaterThanOrEqual(70);
  });

  it("returns CLEAN on no signals", () => {
    const res = computeMMScore({
      chain: "SOL",
      target: "target",
      transfers: [],
      fundingEvents: [],
      relatedWallets: [],
    });
    expect(res.verdict).toBe("CLEAN");
    expect(res.mmScore).toBe(0);
    // CLEAN + no signals → signals array stays empty. The old "No
    // market-manipulation signals detected" placeholder is gone: MMScoreBadge
    // now returns null when the array is empty, so there is no UI text to
    // assert on here. Contract: no entry means nothing fired.
    expect(res.signals).toHaveLength(0);
    expect(res.signalsFr).toHaveLength(0);
  });

  it("falls back cleanly on empty transfer sample", () => {
    const res = computeMMScore({
      chain: "SOL",
      target: "target",
      transfers: [],
      fundingEvents: [{ wallet: "target", source: "x" }],
      relatedWallets: [],
    });
    expect(res.verdict).toBe("CLEAN");
    expect(res.wash.sampleSize).toBe(0);
  });
});
