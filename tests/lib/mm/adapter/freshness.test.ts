import { describe, it, expect } from "vitest";
import {
  computeFreshness,
  stalenessOf,
} from "@/lib/mm/adapter/freshness";

describe("stalenessOf", () => {
  it("classifies < 6h as fresh", () => {
    expect(stalenessOf(0)).toBe("fresh");
    expect(stalenessOf(5 * 60 + 59)).toBe("fresh");
  });
  it("classifies 6h–24h as aging", () => {
    expect(stalenessOf(6 * 60)).toBe("aging");
    expect(stalenessOf(23 * 60 + 59)).toBe("aging");
  });
  it("classifies ≥ 24h as stale", () => {
    expect(stalenessOf(24 * 60)).toBe("stale");
    expect(stalenessOf(48 * 60)).toBe("stale");
  });
});

describe("computeFreshness", () => {
  const NOW = new Date("2026-04-17T12:00:00.000Z").getTime();

  it("returns ageMinutes 0 for a brand-new timestamp", () => {
    const f = computeFreshness(new Date(NOW), NOW);
    expect(f.ageMinutes).toBe(0);
    expect(f.staleness).toBe("fresh");
  });

  it("returns aging for a 10h-old timestamp", () => {
    const f = computeFreshness(new Date(NOW - 10 * 3_600_000), NOW);
    expect(f.ageMinutes).toBe(10 * 60);
    expect(f.staleness).toBe("aging");
  });

  it("returns stale for a 36h-old timestamp", () => {
    const f = computeFreshness(new Date(NOW - 36 * 3_600_000), NOW);
    expect(f.ageMinutes).toBe(36 * 60);
    expect(f.staleness).toBe("stale");
  });

  it("accepts an ISO string", () => {
    const iso = new Date(NOW - 2 * 3_600_000).toISOString();
    const f = computeFreshness(iso, NOW);
    expect(f.staleness).toBe("fresh");
    expect(f.computedAt).toBe(iso);
  });

  it("never returns negative ageMinutes even when clock skews", () => {
    const future = new Date(NOW + 60_000);
    const f = computeFreshness(future, NOW);
    expect(f.ageMinutes).toBe(0);
  });
});
