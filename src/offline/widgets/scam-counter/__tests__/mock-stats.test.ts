import { describe, test, expect } from "vitest";

import {
  MOCK_STATS,
  SCAM_CATEGORIES,
  type ScamCategory,
} from "../_data/mock-stats";

describe("Scam Counter — mock-stats invariants", () => {
  test("total equals the sum of byCategory counts", () => {
    const sum = (Object.values(MOCK_STATS.byCategory) as number[]).reduce(
      (a, b) => a + b,
      0,
    );
    expect(sum).toBe(MOCK_STATS.total);
  });

  test("every ScamCategory has a byCategory entry", () => {
    for (const c of SCAM_CATEGORIES) {
      expect(MOCK_STATS.byCategory).toHaveProperty(c);
      expect(typeof MOCK_STATS.byCategory[c as ScamCategory]).toBe("number");
    }
  });

  test("trend.direction is one of up | down | flat", () => {
    expect(["up", "down", "flat"]).toContain(MOCK_STATS.trend.direction);
  });

  test("lastUpdated is a static ISO date (YYYY-MM-DD)", () => {
    // Guards against `new Date().toISOString()` slipping in at runtime —
    // that would break determinism in snapshot tests and CI re-runs.
    expect(MOCK_STATS.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
