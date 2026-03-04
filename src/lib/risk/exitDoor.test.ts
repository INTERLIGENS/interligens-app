import { describe, it, expect } from "vitest";
import { computeExitDoor } from "./exitDoor";

describe("computeExitDoor", () => {
  it("unavailable => BLOCKED", () => {
    expect(computeExitDoor({ data_unavailable: true }).level).toBe("BLOCKED");
  });
  it("liq=10k => BLOCKED", () => {
    expect(computeExitDoor({ liquidity_usd: 10_000 }).level).toBe("BLOCKED");
  });
  it("liq=50k => TIGHT", () => {
    expect(computeExitDoor({ liquidity_usd: 50_000 }).level).toBe("TIGHT");
  });
  it("liq=200k => OPEN", () => {
    expect(computeExitDoor({ liquidity_usd: 200_000 }).level).toBe("OPEN");
  });
  it("liq=200k but pool age 1 day => TIGHT", () => {
    expect(computeExitDoor({ liquidity_usd: 200_000, pair_age_days: 1 }).level).toBe("TIGHT");
  });
});
