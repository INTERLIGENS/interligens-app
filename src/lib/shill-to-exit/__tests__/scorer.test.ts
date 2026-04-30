import { describe, it, expect } from "vitest";
import { scoreShillToExit, confidenceFromDays, scoreFromResult } from "../scorer";
import type { ShillToExitResult } from "../types";

const T0 = new Date("2025-01-01T10:00:00Z");
const T1 = new Date("2025-01-02T10:00:00Z");

function mkResult(deltaDays: number, estimatedProfit: number): ShillToExitResult {
  return {
    handle: "kol",
    token: "SCAM",
    shillDate: T0,
    exitDate: T1,
    deltaDays,
    estimatedProfit,
    confidence: "HIGH",
    timeline: [],
  };
}

describe("scoreShillToExit", () => {
  it("gives 30 points for < 24h exit", () => {
    const score = scoreShillToExit({ deltaDays: 0.5, estimatedProfit: 0, patternCount: 1 });
    expect(score).toBe(30);
  });

  it("gives 20 points for < 3 days exit", () => {
    const score = scoreShillToExit({ deltaDays: 2, estimatedProfit: 0, patternCount: 1 });
    expect(score).toBe(20);
  });

  it("gives 10 points for < 7 days exit", () => {
    const score = scoreShillToExit({ deltaDays: 5, estimatedProfit: 0, patternCount: 1 });
    expect(score).toBe(10);
  });

  it("adds 20 points for profit > $10K", () => {
    const score = scoreShillToExit({ deltaDays: 0.5, estimatedProfit: 15_000, patternCount: 1 });
    expect(score).toBe(50);
  });

  it("adds 10 points for profit > $1K", () => {
    const score = scoreShillToExit({ deltaDays: 0.5, estimatedProfit: 2_000, patternCount: 1 });
    expect(score).toBe(40);
  });

  it("adds 10 points for patternCount > 2", () => {
    const score = scoreShillToExit({ deltaDays: 0.5, estimatedProfit: 0, patternCount: 3 });
    expect(score).toBe(40);
  });

  it("caps at 100", () => {
    const score = scoreShillToExit({ deltaDays: 0.1, estimatedProfit: 100_000, patternCount: 5 });
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns 0 for no signals", () => {
    const score = scoreShillToExit({ deltaDays: 10, estimatedProfit: 0, patternCount: 1 });
    expect(score).toBe(0);
  });
});

describe("confidenceFromDays", () => {
  it("HIGH for < 1 day", () => {
    expect(confidenceFromDays(0.5)).toBe("HIGH");
  });

  it("MEDIUM for < 3 days", () => {
    expect(confidenceFromDays(2)).toBe("MEDIUM");
  });

  it("LOW for >= 3 days", () => {
    expect(confidenceFromDays(5)).toBe("LOW");
  });
});

describe("scoreFromResult", () => {
  it("scores a result correctly", () => {
    const result = mkResult(0.5, 15_000);
    expect(scoreFromResult(result)).toBe(50);
  });

  it("includes pattern count bonus", () => {
    const result = mkResult(0.5, 0);
    expect(scoreFromResult(result, 3)).toBe(40);
  });
});
