import { describe, it, expect } from "vitest";
import { computeWhaleLevel } from "./whales";

describe("computeWhaleLevel", () => {
  it("null => MED", () => {
    expect(computeWhaleLevel(null).level).toBe("MED");
  });
  it("70 => HIGH", () => {
    expect(computeWhaleLevel({ top10_pct: 70 }).level).toBe("HIGH");
  });
  it("40 => MED", () => {
    expect(computeWhaleLevel({ top10_pct: 40 }).level).toBe("MED");
  });
  it("20 => LOW", () => {
    expect(computeWhaleLevel({ top10_pct: 20 }).level).toBe("LOW");
  });
});
