import { describe, it, expect } from "vitest";
import { runFakeLiquidityDetector } from "@/lib/mm/engine/detectors/fakeLiquidity";
import type { FakeLiquidityInput } from "@/lib/mm/engine/types";

function base(
  overrides: Partial<FakeLiquidityInput> = {},
): FakeLiquidityInput {
  return {
    tokenAddress: "0xTOKEN",
    chain: "ETHEREUM",
    totalLiquidityUsd: 1_000_000,
    dailyVolumeUsd: 500_000,
    volumeByWallet: [
      { wallet: "W1", volumeUsd: 100_000 },
      { wallet: "W2", volumeUsd: 100_000 },
      { wallet: "W3", volumeUsd: 100_000 },
      { wallet: "W4", volumeUsd: 100_000 },
      { wallet: "W5", volumeUsd: 100_000 },
    ],
    liquidityProviders: [
      { wallet: "LP1", liquidityUsd: 300_000 },
      { wallet: "LP2", liquidityUsd: 300_000 },
      { wallet: "LP3", liquidityUsd: 200_000 },
      { wallet: "LP4", liquidityUsd: 200_000 },
    ],
    poolCount: 2,
    ...overrides,
  };
}

describe("runFakeLiquidityDetector — sub-signals", () => {
  it("fires VOLUME_LIQUIDITY_MISMATCH (HIGH) when ratio ≥ 10", () => {
    const r = runFakeLiquidityDetector(
      base({ dailyVolumeUsd: 15_000_000, totalLiquidityUsd: 1_000_000 }),
    );
    const s = r.signals.find((x) => x.type === "VOLUME_LIQUIDITY_MISMATCH");
    expect(s?.severity).toBe("HIGH");
    expect(s?.metric).toBeGreaterThanOrEqual(10);
  });

  it("fires VOLUME_LIQUIDITY_MISMATCH (MEDIUM) when ratio ∈ [5,10)", () => {
    const r = runFakeLiquidityDetector(
      base({ dailyVolumeUsd: 6_000_000, totalLiquidityUsd: 1_000_000 }),
    );
    const s = r.signals.find((x) => x.type === "VOLUME_LIQUIDITY_MISMATCH");
    expect(s?.severity).toBe("MEDIUM");
  });

  it("no VOLUME_LIQUIDITY_MISMATCH when ratio < 5", () => {
    const r = runFakeLiquidityDetector(
      base({ dailyVolumeUsd: 2_000_000, totalLiquidityUsd: 1_000_000 }),
    );
    expect(
      r.signals.find((x) => x.type === "VOLUME_LIQUIDITY_MISMATCH"),
    ).toBeUndefined();
  });

  it("fires LIQUIDITY_CONCENTRATION (HIGH) when top-1 LP > 80%", () => {
    const r = runFakeLiquidityDetector(
      base({
        liquidityProviders: [
          { wallet: "LP1", liquidityUsd: 9_000_000 },
          { wallet: "LP2", liquidityUsd: 500_000 },
          { wallet: "LP3", liquidityUsd: 500_000 },
        ],
      }),
    );
    const s = r.signals.find((x) => x.type === "LIQUIDITY_CONCENTRATION");
    expect(s?.severity).toBe("HIGH");
  });

  it("fires LIQUIDITY_CONCENTRATION (MEDIUM) on top-3 > 90%", () => {
    const r = runFakeLiquidityDetector(
      base({
        liquidityProviders: [
          { wallet: "LP1", liquidityUsd: 400_000 },
          { wallet: "LP2", liquidityUsd: 300_000 },
          { wallet: "LP3", liquidityUsd: 250_000 },
          { wallet: "LP4", liquidityUsd: 50_000 },
        ],
      }),
    );
    const s = r.signals.find((x) => x.type === "LIQUIDITY_CONCENTRATION");
    expect(s?.severity).toBe("MEDIUM");
  });

  it("fires PHANTOM_VOLUME when top-5 drive >80% of a ≥500K volume pool", () => {
    const r = runFakeLiquidityDetector(
      base({
        volumeByWallet: [
          { wallet: "A", volumeUsd: 300_000 },
          { wallet: "B", volumeUsd: 200_000 },
          { wallet: "C", volumeUsd: 100_000 },
          { wallet: "D", volumeUsd: 50_000 },
          { wallet: "E", volumeUsd: 50_000 },
          { wallet: "F", volumeUsd: 20_000 },
          { wallet: "G", volumeUsd: 20_000 },
        ],
      }),
    );
    const s = r.signals.find((x) => x.type === "PHANTOM_VOLUME");
    expect(s).toBeDefined();
    expect(s?.severity).toBe("HIGH");
  });

  it("ignores PHANTOM_VOLUME on dust-volume tokens", () => {
    const r = runFakeLiquidityDetector(
      base({
        volumeByWallet: [
          { wallet: "A", volumeUsd: 200 },
          { wallet: "B", volumeUsd: 100 },
          { wallet: "C", volumeUsd: 50 },
        ],
      }),
    );
    expect(
      r.signals.find((x) => x.type === "PHANTOM_VOLUME"),
    ).toBeUndefined();
  });

  it("fires POOL_FRAGMENTATION only on microcaps", () => {
    const microcap = runFakeLiquidityDetector(
      base({ totalLiquidityUsd: 200_000, poolCount: 14 }),
    );
    expect(
      microcap.signals.find((x) => x.type === "POOL_FRAGMENTATION")?.severity,
    ).toBe("MEDIUM");
    const largeCap = runFakeLiquidityDetector(
      base({ totalLiquidityUsd: 50_000_000, poolCount: 14 }),
    );
    expect(
      largeCap.signals.find((x) => x.type === "POOL_FRAGMENTATION"),
    ).toBeUndefined();
  });

  it("caps score at 20 even when every sub-signal fires", () => {
    const r = runFakeLiquidityDetector(
      base({
        totalLiquidityUsd: 100_000,
        dailyVolumeUsd: 5_000_000, // ratio 50 → MISMATCH (+8)
        liquidityProviders: [
          { wallet: "LP1", liquidityUsd: 95_000 },
          { wallet: "LP2", liquidityUsd: 5_000 },
        ], // top-1 > 80% → CONCENTRATION (+5)
        volumeByWallet: [
          { wallet: "A", volumeUsd: 400_000 },
          { wallet: "B", volumeUsd: 200_000 },
          { wallet: "C", volumeUsd: 50_000 },
          { wallet: "D", volumeUsd: 10_000 },
          { wallet: "E", volumeUsd: 10_000 },
          { wallet: "F", volumeUsd: 500 },
        ], // PHANTOM (+5)
        poolCount: 20, // microcap + fragmentation (+2)
      }),
    );
    expect(r.score).toBe(20);
    expect(r.maxScore).toBe(20);
    expect(r.signals.length).toBeGreaterThanOrEqual(3);
  });

  it("returns a typed DetectorOutput with FAKE_LIQUIDITY detectorType", () => {
    const r = runFakeLiquidityDetector(base());
    expect(r.detectorType).toBe("FAKE_LIQUIDITY");
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("survives zero / empty inputs without throwing", () => {
    const r = runFakeLiquidityDetector({
      tokenAddress: "0xTOKEN",
      chain: "ETHEREUM",
      totalLiquidityUsd: 0,
      dailyVolumeUsd: 0,
      volumeByWallet: [],
      liquidityProviders: [],
      poolCount: 0,
    });
    expect(r.score).toBe(0);
    expect(r.signals).toEqual([]);
  });
});
