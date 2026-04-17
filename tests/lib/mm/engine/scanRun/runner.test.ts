import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    mmCohortPercentile: {
      findMany: (...args: unknown[]) => findMany(...args),
    },
  },
}));

import { runScan, runScanWithCohort } from "@/lib/mm/engine/scanRun/runner";
import { hardcodedPercentiles } from "@/lib/mm/engine/cohorts/percentileCache";
import type {
  ClusterInput,
  ConcentrationInput,
  PostListingPumpInput,
  PriceAsymmetryInput,
  ScanRunInput,
} from "@/lib/mm/engine/types";
import {
  asymmetricPriceToken,
  concentratedToken,
  postListingPump,
  retailClean,
  washPattern,
} from "../../fixtures/generate";

const FIXTURE_DIR = join(process.cwd(), "tests", "lib", "mm", "fixtures");
const loadJson = <T>(f: string): T =>
  JSON.parse(readFileSync(join(FIXTURE_DIR, f), "utf-8")) as T;

describe("runScan orchestration (Phase 4 — 5 detectors)", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("returns a zeroed result when no detector inputs are provided", () => {
    const r = runScan({
      subjectType: "WALLET",
      subjectId: "0xnone",
      chain: "ETHEREUM",
    });
    expect(r.behaviorDrivenScore).toBe(0);
    expect(r.confidence).toBe("low");
    expect(r.coverage).toBe("low");
    expect(r.signals).toEqual([]);
    expect(r.detectorBreakdown.washTrading).toBeNull();
    expect(r.detectorBreakdown.priceAsymmetry).toBeNull();
    expect(r.detectorBreakdown.postListingPump).toBeNull();
    expect(r.cohortKey).toBeNull();
    expect(r.cohortPercentiles).toBeNull();
  });

  it("runs all 5 detectors when all inputs are present", () => {
    const input: ScanRunInput = {
      subjectType: "TOKEN",
      subjectId: "TKN",
      chain: "SOLANA",
      walletAgeDays: 90,
      washTrading: washPattern({ pairCount: 10, volumeUsd: 100_000 }),
      cluster: loadJson<ClusterInput>("gotbit-cluster.json"),
      concentration: loadJson<ConcentrationInput>("concentrated-token.json"),
      priceAsymmetry: loadJson<PriceAsymmetryInput>("asymmetric-price-token.json"),
      postListingPump: loadJson<PostListingPumpInput>("post-listing-pump.json"),
    };
    const r = runScan(input);
    expect(r.detectorBreakdown.washTrading).not.toBeNull();
    expect(r.detectorBreakdown.cluster).not.toBeNull();
    expect(r.detectorBreakdown.concentration).not.toBeNull();
    expect(r.detectorBreakdown.priceAsymmetry).not.toBeNull();
    expect(r.detectorBreakdown.postListingPump).not.toBeNull();
  });

  it("admits secondary detectors when ≥ 1 core HIGH signal present", () => {
    const input: ScanRunInput = {
      subjectType: "TOKEN",
      subjectId: "TKN",
      chain: "SOLANA",
      walletAgeDays: 90,
      washTrading: washPattern({ pairCount: 10, volumeUsd: 100_000 }),
      cluster: loadJson<ClusterInput>("gotbit-cluster.json"),
      concentration: loadJson<ConcentrationInput>("concentrated-token.json"),
      priceAsymmetry: asymmetricPriceToken({ upDownRatio: 6 }),
      postListingPump: postListingPump({ performancePct: 1.5, topDominance: 0.8 }),
    };
    const r = runScan(input);
    expect(r.coOccurrence.admitted).toEqual(
      expect.arrayContaining(["PRICE_ASYMMETRY", "POST_LISTING_PUMP"]),
    );
    expect(r.coOccurrence.gatedOut).toEqual([]);
    // raw score should exceed core-only because secondaries added points
    expect(r.rawBehaviorScore).toBeGreaterThanOrEqual(75);
  });

  it("gates secondary detectors when no core HIGH signal", () => {
    const input: ScanRunInput = {
      subjectType: "TOKEN",
      subjectId: "CLEAN",
      chain: "SOLANA",
      walletAgeDays: 90,
      washTrading: retailClean({ wallets: 80 }),
      priceAsymmetry: asymmetricPriceToken({ upDownRatio: 8 }),
      postListingPump: postListingPump({ performancePct: 1.5, topDominance: 0.8 }),
    };
    const r = runScan(input);
    expect(r.coOccurrence.gatedOut).toEqual(
      expect.arrayContaining(["PRICE_ASYMMETRY", "POST_LISTING_PUMP"]),
    );
    expect(r.coOccurrence.admitted).toEqual([]);
    expect(r.behaviorDrivenScore).toBe(0); // no core signal, no secondary contribution
  });

  it("caps the full maxed pipeline at the 90 engine ceiling", () => {
    const input: ScanRunInput = {
      subjectType: "TOKEN",
      subjectId: "TKN",
      chain: "SOLANA",
      walletAgeDays: 180,
      washTrading: washPattern({ pairCount: 10, volumeUsd: 100_000 }),
      cluster: loadJson<ClusterInput>("gotbit-cluster.json"),
      concentration: loadJson<ConcentrationInput>("concentrated-token.json"),
      priceAsymmetry: asymmetricPriceToken({ upDownRatio: 8 }),
      postListingPump: postListingPump({ performancePct: 1.8, topDominance: 0.85 }),
    };
    const r = runScan(input);
    expect(r.behaviorDrivenScore).toBeLessThanOrEqual(90);
  });

  it("propagates cohort percentiles into the detectors when provided", () => {
    const percentiles = hardcodedPercentiles("sol:micro:new");
    const input: ScanRunInput = {
      subjectType: "TOKEN",
      subjectId: "TKN",
      chain: "SOLANA",
      walletAgeDays: 90,
      concentration: concentratedToken({ wallets: 20, topDominance: 0.95 }),
      cohortKey: "sol:micro:new",
      cohortPercentiles: percentiles,
    };
    const r = runScan(input);
    const evid = r.detectorBreakdown.concentration!.evidence as {
      thresholdSource: string;
      cohortKey: string;
    };
    expect(evid.thresholdSource).toBe("cohort_p99");
    expect(evid.cohortKey).toBe("sol:micro:new");
    expect(r.cohortKey).toBe("sol:micro:new");
    expect(r.cohortPercentiles).toBe(percentiles);
  });

  it("runScanWithCohort resolves percentiles via percentileCache", async () => {
    findMany.mockResolvedValue([]); // stub fallback
    const r = await runScanWithCohort({
      subjectType: "TOKEN",
      subjectId: "T",
      chain: "SOLANA",
      walletAgeDays: 90,
      concentration: concentratedToken({ wallets: 20, topDominance: 0.95 }),
      cohortKey: "sol:micro:new",
    });
    expect(r.cohortKey).toBe("sol:micro:new");
    expect(r.cohortPercentiles?.sourceKind).toBe("stub");
    expect(r.detectorBreakdown.concentration!.score).toBeGreaterThan(0);
  });

  it("runScanWithCohort is a no-op when cohortKey is absent", async () => {
    const r = await runScanWithCohort({
      subjectType: "WALLET",
      subjectId: "w",
      chain: "ETHEREUM",
    });
    expect(r.cohortKey).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("applies cap_wallet_age_lt_7d when walletAgeDays < 7", () => {
    const input: ScanRunInput = {
      subjectType: "WALLET",
      subjectId: "0xnew",
      chain: "ETHEREUM",
      walletAgeDays: 2,
      washTrading: washPattern({ pairCount: 10, volumeUsd: 100_000 }),
      cluster: loadJson<ClusterInput>("gotbit-cluster.json"),
      concentration: concentratedToken({ wallets: 20, topDominance: 0.95 }),
    };
    const r = runScan(input);
    expect(r.capsApplied.some((c) => c.startsWith("cap_wallet_age_lt_7d"))).toBe(true);
    expect(r.behaviorDrivenScore).toBeLessThanOrEqual(59);
  });
});
