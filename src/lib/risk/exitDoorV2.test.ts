import { describe, it, expect } from "vitest";
import { estimateSellImpactUSD } from "./exitDoorV2";

describe("estimateSellImpactUSD", () => {
  it("GOOD: liq 1M, sell 1k -> slippage <3%", () => {
    const r = estimateSellImpactUSD(1000, { liquidity_usd: 1_000_000 });
    expect(r.bucket).toBe("GOOD");
    expect(r.est_slippage_pct).toBeLessThan(3);
    expect(r.est_received_usd).toBeGreaterThan(970);
  });

  it("BAD: liq 50k, sell 10k -> slippage >10%", () => {
    const r = estimateSellImpactUSD(10_000, { liquidity_usd: 50_000 });
    expect(r.bucket).toBe("BAD");
    expect(r.est_slippage_pct).toBeGreaterThan(10);
  });

  it("unavailable -> null + BAD", () => {
    const r = estimateSellImpactUSD(1000, { data_unavailable: true });
    expect(r.bucket).toBe("BAD");
    expect(r.est_slippage_pct).toBeNull();
    expect(r.est_received_usd).toBeNull();
  });

  it("clamp: slippage never >99", () => {
    const r = estimateSellImpactUSD(1_000_000, { liquidity_usd: 100 });
    expect(r.est_slippage_pct).toBeLessThanOrEqual(99);
  });
});
