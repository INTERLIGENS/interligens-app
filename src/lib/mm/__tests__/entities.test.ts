import { describe, it, expect } from "vitest";
import { assertValidSlug, defaultScoreFor } from "@/lib/mm/registry/entities";

describe("assertValidSlug", () => {
  it("accepts kebab-case lowercase alphanumerics", () => {
    for (const ok of ["gotbit", "cls-global", "zm-quant", "a1", "x-y-z"]) {
      expect(() => assertValidSlug(ok)).not.toThrow();
    }
  });

  it("rejects uppercase, spaces, leading/trailing dashes, special chars", () => {
    for (const bad of [
      "Gotbit",
      "cls global",
      "-leading",
      "trailing-",
      "has_underscore",
      "has/slash",
      "",
    ]) {
      expect(() => assertValidSlug(bad)).toThrow();
    }
  });
});

describe("defaultScoreFor", () => {
  it("maps CONVICTED to the midpoint of 90-100 (95)", () => {
    expect(defaultScoreFor("CONVICTED")).toBe(95);
  });

  it("maps CHARGED to midpoint of 75-89 (82)", () => {
    expect(defaultScoreFor("CHARGED")).toBe(82);
  });

  it("maps OBSERVED to 0", () => {
    expect(defaultScoreFor("OBSERVED")).toBe(0);
  });

  it("maps SETTLED inside its range", () => {
    const s = defaultScoreFor("SETTLED");
    expect(s).toBeGreaterThanOrEqual(65);
    expect(s).toBeLessThanOrEqual(74);
  });
});
