import { describe, it, expect } from "vitest";
import { computeTigerScore } from "./engine";

describe("TigerScore Engine v1", () => {
  it("1) unlimitedApprovals=1 => RED, score>=70", () => {
    const r = computeTigerScore({ chain: "ETH", unlimitedApprovals: 1 });
    expect(r.tier).toBe("RED");
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it("2) approvalsTotal=10 (no unlimited) => score>=35", () => {
    const r = computeTigerScore({ chain: "ETH", approvalsTotal: 10 });
    expect(r.score).toBeGreaterThanOrEqual(35);
  });

  it("3) unknownPrograms=3 => driver unknown_programs present", () => {
    const r = computeTigerScore({ chain: "SOL", unknownPrograms: 3 });
    expect(r.drivers.some(d => d.id === "unknown_programs")).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(35);
  });

  it("4) freezeAuthority=true => RED", () => {
    const r = computeTigerScore({ chain: "SOL", freezeAuthority: true });
    expect(r.tier).toBe("RED");
  });

  it("5) mintAuthorityActive=true => score>=35 + driver present", () => {
    const r = computeTigerScore({ chain: "SOL", mintAuthorityActive: true });
    expect(r.score).toBeGreaterThanOrEqual(35);
    expect(r.drivers.some(d => d.id === "mint_authority")).toBe(true);
  });

  it("6) txCount=0 => driver low_tx_count present", () => {
    const r = computeTigerScore({ chain: "SOL", txCount: 0 });
    expect(r.drivers.some(d => d.id === "low_tx_count")).toBe(true);
  });

  it("7) confirmedCriticalClaims=1 => RED, score>=70", () => {
    const r = computeTigerScore({ chain: "SOL", confirmedCriticalClaims: 1 });
    expect(r.tier).toBe("RED");
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it("8) deep=true => confidence High", () => {
    const r = computeTigerScore({ chain: "ETH", unlimitedApprovals: 1, deep: true });
    expect(r.confidence).toBe("High");
  });
});
