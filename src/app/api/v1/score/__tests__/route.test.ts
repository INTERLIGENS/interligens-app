import { describe, it, expect, beforeEach } from "vitest";
import { isValidMint, mapSeverity } from "@/lib/publicScore/schema";
import { checkRateLimit, __resetForTest } from "@/lib/publicScore/rateLimit";

// -- Schema validation tests --------------------------------------------------

describe("isValidMint", () => {
  it("accepts a valid Solana mint address", () => {
    expect(isValidMint("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toBe(true);
  });

  it("accepts a 32-char base58 address", () => {
    expect(isValidMint("11111111111111111111111111111111")).toBe(true);
  });

  it("rejects too-short strings", () => {
    expect(isValidMint("abc")).toBe(false);
  });

  it("rejects strings with invalid base58 characters (0, O, I, l)", () => {
    expect(isValidMint("0OIl" + "1".repeat(40))).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidMint("")).toBe(false);
  });

  it("rejects strings longer than 44 chars", () => {
    expect(isValidMint("A".repeat(45))).toBe(false);
  });
});

describe("mapSeverity", () => {
  it("maps lowercase to uppercase", () => {
    expect(mapSeverity("critical")).toBe("CRITICAL");
    expect(mapSeverity("high")).toBe("HIGH");
    expect(mapSeverity("med")).toBe("MEDIUM");
    expect(mapSeverity("low")).toBe("LOW");
  });

  it("defaults unknown values to LOW", () => {
    expect(mapSeverity("unknown")).toBe("LOW");
  });
});

// -- Rate limiter tests -------------------------------------------------------

describe("checkRateLimit", () => {
  beforeEach(() => {
    __resetForTest();
  });

  it("allows the first request", () => {
    const result = checkRateLimit("1.2.3.4");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });

  it("allows 60 requests within a window", () => {
    for (let i = 0; i < 60; i++) {
      const r = checkRateLimit("1.2.3.4");
      expect(r.allowed).toBe(true);
    }
  });

  it("blocks the 61st request (rate limit exceeded)", () => {
    for (let i = 0; i < 60; i++) {
      checkRateLimit("1.2.3.4");
    }
    const blocked = checkRateLimit("1.2.3.4");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("rate limits are per-IP", () => {
    for (let i = 0; i < 60; i++) {
      checkRateLimit("1.2.3.4");
    }
    const otherIp = checkRateLimit("5.6.7.8");
    expect(otherIp.allowed).toBe(true);
    expect(otherIp.remaining).toBe(59);
  });
});
