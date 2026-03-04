import { describe, it, expect } from "vitest";
import { computeCabalScore } from "./cabal";

describe("computeCabalScore", () => {
  // ── legacy tests ──
  it("casefile + pump => HIGH (any chain)", () => {
    const r = computeCabalScore({
      chain: "SOL",
      off_chain: { case_id: "C-001" },
      tiger_drivers: ["pump_fun"],
    });
    expect(r.tier).toBe("HIGH");
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it("none => LOW", () => {
    const r = computeCabalScore({});
    expect(r.tier).toBe("LOW");
    expect(r.score).toBe(20);
  });

  it("cap at 100", () => {
    const r = computeCabalScore({
      chain: "SOL",
      off_chain: { case_id: "X" },
      tiger_drivers: ["pump_fun"],
      market: { volume_24h_usd: 1_000_000, liquidity_usd: 10_000 },
    });
    expect(r.score).toBeLessThanOrEqual(100);
  });

  // ── new multi-chain tests ──
  it("SOL pump (no casefile) => score >=45, driver pump_like", () => {
    const r = computeCabalScore({
      chain: "SOL",
      tiger_drivers: ["pump_fun"],
    });
    expect(r.score).toBeGreaterThanOrEqual(45);
    expect(r.drivers).toContain("pump_like");
  });

  it("SOL address ends with 'pump' => driver pump_like", () => {
    const r = computeCabalScore({
      chain: "SOL",
      address: "a3W4qutoEJA4232T2gwZUfgYJTetr96pU4SJMwppump",
    });
    expect(r.drivers).toContain("pump_like");
  });

  it("ETH with 2 unknown spenders => driver unknown_spenders", () => {
    const r = computeCabalScore({
      chain: "ETH",
      spenders: [
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222",
      ],
    });
    expect(r.drivers).toContain("unknown_spenders");
  });

  it("ETH with unlimitedCount=1 => driver unlimited_approvals", () => {
    const r = computeCabalScore({
      chain: "ETH",
      spenders: [],
      unlimitedCount: 1,
    });
    expect(r.drivers).toContain("unlimited_approvals");
  });

  it("casefile_present adds +30 on BSC", () => {
    const base = computeCabalScore({ chain: "BSC" });
    const withCase = computeCabalScore({ chain: "BSC", off_chain: { case_id: "X" } });
    expect(withCase.score - base.score).toBe(30);
    expect(withCase.drivers).toContain("casefile_present");
  });

  it("ETH null spenders => limitedData suffix in why", () => {
    const r = computeCabalScore({ chain: "ETH" });
    expect(r.why_en).toContain("limited data");
  });

  it("drivers capped at 3", () => {
    const r = computeCabalScore({
      chain: "SOL",
      off_chain: { case_id: "X" },
      tiger_drivers: ["pump_fun"],
      market: { volume_24h_usd: 1_000_000, liquidity_usd: 10_000 },
      social: { discord: { spike: true } },
    });
    expect(r.drivers.length).toBeLessThanOrEqual(3);
  });
});
