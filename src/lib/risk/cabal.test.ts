import { describe, it, expect } from "vitest";
import { computeCabalScore } from "./cabal";

describe("computeCabalScore", () => {
  it("casefile + pump => HIGH", () => {
    const r = computeCabalScore({
      off_chain: { case_id: "C-001" },
      tiger_drivers: ["pump_fun"],
    });
    expect(r.tier).toBe("HIGH");
    expect(r.score).toBeGreaterThanOrEqual(70);
  });
  it("pump only => MED", () => {
    const r = computeCabalScore({ tiger_drivers: ["pump_fun"] });
    expect(r.score).toBe(45);
    expect(r.tier).toBe("MED");
  });
  it("none => LOW", () => {
    const r = computeCabalScore({});
    expect(r.tier).toBe("LOW");
    expect(r.score).toBe(20);
  });
  it("cap at 100", () => {
    const r = computeCabalScore({
      off_chain: { case_id: "X" },
      tiger_drivers: ["pump_fun"],
      market: { volume_24h_usd: 1_000_000, liquidity_usd: 10_000 },
    });
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
