import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  detectConcentration,
  detectMirrored,
  findRoundTrips,
  runWashTradingDetector,
  TEMP_THRESHOLDS,
} from "@/lib/mm/engine/detectors/washTrading";
import type { WashTradingInput } from "@/lib/mm/engine/types";
import {
  retailClean,
  washPattern,
  mkTx,
} from "../../fixtures/generate";

const FIXTURE_DIR = join(process.cwd(), "tests", "lib", "mm", "fixtures");
const loadJson = <T>(f: string): T =>
  JSON.parse(readFileSync(join(FIXTURE_DIR, f), "utf-8")) as T;

describe("washTrading — CONCENTRATION sub-signal", () => {
  it("returns no signal on retail-clean fixture", () => {
    const fx = loadJson<WashTradingInput>("retail-clean.json");
    const r = detectConcentration(fx.txs);
    expect(r.triggered).toBe(false);
    expect(r.signal).toBeUndefined();
  });

  it("triggers when a few buyers push huge volume", () => {
    const txs = [
      mkTx({ buyer: "A", seller: "LP", volumeUsd: 100_000, block: 1, timestamp: 0, side: "BUY" }),
      mkTx({ buyer: "B", seller: "LP", volumeUsd: 100_000, block: 2, timestamp: 1, side: "BUY" }),
      mkTx({ buyer: "C", seller: "LP", volumeUsd: 100_000, block: 3, timestamp: 2, side: "BUY" }),
    ];
    const r = detectConcentration(txs);
    expect(r.triggered).toBe(true);
    expect(r.uniqueBuyers).toBe(3);
    expect(r.avgVolPerBuyer).toBe(100_000);
    expect(r.signal?.severity).toBe("HIGH");
  });

  it("does not trigger when buyers exceed max unique-buyer cap", () => {
    const txs = Array.from({ length: 30 }, (_, i) =>
      mkTx({
        buyer: `w-${i}`,
        seller: "LP",
        volumeUsd: 200_000,
        block: i,
        timestamp: i,
        side: "BUY",
      }),
    );
    const r = detectConcentration(txs);
    expect(r.uniqueBuyers).toBeGreaterThanOrEqual(
      TEMP_THRESHOLDS.CONCENTRATION_MAX_UNIQUE_BUYERS,
    );
    expect(r.triggered).toBe(false);
  });
});

describe("washTrading — ROUND_TRIP sub-signal", () => {
  it("finds A→B→A within block window", () => {
    const txs = [
      mkTx({ buyer: "B", seller: "A", block: 100, timestamp: 0, side: "BUY" }),
      mkTx({ buyer: "A", seller: "B", block: 150, timestamp: 1, side: "SELL" }),
    ];
    const trips = findRoundTrips(txs, 100);
    expect(trips).toHaveLength(1);
    expect(trips[0]).toMatchObject({ origin: "A", via: "B" });
  });

  it("ignores legs outside the block window", () => {
    const txs = [
      mkTx({ buyer: "B", seller: "A", block: 100, timestamp: 0, side: "BUY" }),
      mkTx({ buyer: "A", seller: "B", block: 300, timestamp: 1, side: "SELL" }),
    ];
    expect(findRoundTrips(txs, 100)).toHaveLength(0);
  });

  it("detects many pairs in the alameda-wash-pattern fixture", () => {
    const fx = loadJson<WashTradingInput>("alameda-wash-pattern.json");
    const trips = findRoundTrips(fx.txs, 100);
    expect(trips.length).toBeGreaterThanOrEqual(5);
  });

  it("returns [] on empty input", () => {
    expect(findRoundTrips([])).toEqual([]);
  });
});

describe("washTrading — MIRRORED sub-signal", () => {
  it("returns a high ratio on symmetric buy/sell volumes", () => {
    const txs = [
      mkTx({ buyer: "A", seller: "LP", volumeUsd: 10_000, block: 1, timestamp: 0, side: "BUY" }),
      mkTx({ buyer: "B", seller: "LP", volumeUsd: 10_000, block: 2, timestamp: 600, side: "SELL" }),
      mkTx({ buyer: "C", seller: "LP", volumeUsd: 10_000, block: 3, timestamp: 1200, side: "BUY" }),
      mkTx({ buyer: "D", seller: "LP", volumeUsd: 10_000, block: 4, timestamp: 1800, side: "SELL" }),
    ];
    const m = detectMirrored(txs, 3600);
    expect(m?.ratio).toBeGreaterThanOrEqual(0.85);
  });

  it("returns null on empty tx list", () => {
    expect(detectMirrored([], 3600)).toBeNull();
  });
});

describe("washTrading — integrated runner", () => {
  it("returns score 0 on retail-clean fixture", () => {
    const fx = loadJson<WashTradingInput>("retail-clean.json");
    const out = runWashTradingDetector(fx);
    expect(out.score).toBe(0);
    expect(out.signals).toEqual([]);
    expect(out.detectorType).toBe("WASH_TRADING");
  });

  it("produces full contribution on alameda-wash-pattern fixture", () => {
    const fx = loadJson<WashTradingInput>("alameda-wash-pattern.json");
    const out = runWashTradingDetector(fx);
    expect(out.score).toBeGreaterThan(0);
    expect(out.maxScore).toBe(30);
    const types = out.signals.map((s) => s.type);
    expect(types).toContain("ROUND_TRIP");
    // The pattern has only 2 unique buyers trading 60k each → concentration triggers
    expect(types).toContain("CONCENTRATION_ABOVE_THRESHOLD");
  });

  it("caps contribution at maxScore = 30", () => {
    // Stack all sub-signals to their max: concentration (10) + round-trip (12) + mirrored (8) = 30
    const fx = washPattern({ pairCount: 10, volumeUsd: 100_000 });
    const out = runWashTradingDetector(fx);
    expect(out.score).toBeLessThanOrEqual(30);
    expect(out.score).toBe(30);
  });

  it("exposes evidence for reproducibility", () => {
    const fx = washPattern({ pairCount: 3, volumeUsd: 55_000 });
    const out = runWashTradingDetector(fx);
    expect(out.evidence.tokenId).toBe(fx.tokenId);
    expect(out.evidence).toHaveProperty("totalVolumeUsd");
    expect(out.evidence).toHaveProperty("roundTripCount");
  });

  it("retailClean helper produces varied volumes below threshold", () => {
    const fx = retailClean({ wallets: 80, txsPerWallet: 2 });
    const out = runWashTradingDetector(fx);
    expect(out.score).toBe(0);
  });
});
