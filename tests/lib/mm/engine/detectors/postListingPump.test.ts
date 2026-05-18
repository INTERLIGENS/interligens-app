import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  computePumpMetrics,
  runPostListingPumpDetector,
} from "@/lib/mm/engine/detectors/postListingPump";
import type { PostListingPumpInput } from "@/lib/mm/engine/types";
import { postListingPump } from "../../fixtures/generate";

const FIXTURE_DIR = join(process.cwd(), "tests", "lib", "mm", "fixtures");
const loadJson = <T>(f: string): T =>
  JSON.parse(readFileSync(join(FIXTURE_DIR, f), "utf-8")) as T;

describe("computePumpMetrics", () => {
  it("computes performance and top-N share correctly", () => {
    const m = computePumpMetrics({
      tokenId: "T",
      chain: "SOLANA",
      listingDate: 1,
      priceAtListing: 1,
      priceAt7Days: 3,
      totalVolumeUsd: 100,
      volumeByWallet: [
        { wallet: "w1", volumeUsd: 60 },
        { wallet: "w2", volumeUsd: 30 },
        { wallet: "w3", volumeUsd: 10 },
      ],
      topN: 2,
    });
    expect(m.performancePct).toBe(2); // +200%
    expect(m.topNShare).toBeCloseTo(0.9, 5);
    expect(m.topNWallets).toEqual(["w1", "w2"]);
  });

  it("falls back to sum of volumes when totalVolumeUsd is 0", () => {
    const m = computePumpMetrics({
      tokenId: "T",
      chain: "SOLANA",
      listingDate: 1,
      priceAtListing: 1,
      priceAt7Days: 2,
      totalVolumeUsd: 0,
      volumeByWallet: [
        { wallet: "a", volumeUsd: 50 },
        { wallet: "b", volumeUsd: 50 },
      ],
    });
    expect(m.totalVolumeUsd).toBe(100);
  });
});

describe("runPostListingPumpDetector", () => {
  it("fires HIGH on fixture with +150% and top-10 share > 70%", () => {
    const fx = loadJson<PostListingPumpInput>("post-listing-pump.json");
    const out = runPostListingPumpDetector(fx);
    const types = out.signals.map((s) => s.type);
    expect(types).toContain("POST_LISTING_PUMP");
    expect(out.signals[0].severity).toBe("HIGH");
    expect(
      (out.evidence as { scoreIfCoOccurrent: number }).scoreIfCoOccurrent,
    ).toBe(7);
    expect(out.score).toBe(0); // corroborative until admitted
  });

  it("corroborativeOnly flag is always true", () => {
    const fx = postListingPump({ performancePct: 1.5, topDominance: 0.8 });
    const out = runPostListingPumpDetector(fx);
    expect((out.evidence as { corroborativeOnly: boolean }).corroborativeOnly).toBe(
      true,
    );
  });

  it("emits PARTIAL when price pumps but distribution is diverse", () => {
    const fx = postListingPump({
      performancePct: 2.0,
      topDominance: 0.3,
      wallets: 200,
    });
    const out = runPostListingPumpDetector(fx);
    const types = out.signals.map((s) => s.type);
    expect(types).toContain("POST_LISTING_PUMP_PARTIAL");
    expect(
      (out.evidence as { scoreIfCoOccurrent: number }).scoreIfCoOccurrent,
    ).toBe(0);
  });

  it("emits PARTIAL when concentration is high but no pump", () => {
    const fx = postListingPump({
      performancePct: 0.2,
      topDominance: 0.9,
      wallets: 40,
    });
    const out = runPostListingPumpDetector(fx);
    const types = out.signals.map((s) => s.type);
    expect(types).toContain("POST_LISTING_PUMP_PARTIAL");
  });

  it("no signal at all when neither condition holds", () => {
    const out = runPostListingPumpDetector({
      tokenId: "T",
      chain: "SOLANA",
      listingDate: 1,
      priceAtListing: 1,
      priceAt7Days: 1.2, // +20%
      totalVolumeUsd: 100_000,
      volumeByWallet: Array.from({ length: 80 }, (_, i) => ({
        wallet: `w-${i}`,
        volumeUsd: 1_250,
      })),
    });
    expect(out.signals).toEqual([]);
  });

  it("respects custom thresholds", () => {
    const out = runPostListingPumpDetector({
      tokenId: "T",
      chain: "SOLANA",
      listingDate: 1,
      priceAtListing: 1,
      priceAt7Days: 1.5, // +50%, default threshold is +100%
      totalVolumeUsd: 1_000,
      volumeByWallet: [
        { wallet: "a", volumeUsd: 900 },
        { wallet: "b", volumeUsd: 100 },
      ],
      pumpThreshold: 0.3, // +30%
      concentrationThreshold: 0.5,
      topN: 2,
    });
    const types = out.signals.map((s) => s.type);
    expect(types).toContain("POST_LISTING_PUMP");
  });
});
