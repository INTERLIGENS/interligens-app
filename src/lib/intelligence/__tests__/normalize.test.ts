import { describe, it, expect } from "vitest";
import {
  normalizeAddress,
  normalizeDomain,
  buildDedupKey,
  normalizeValue,
} from "../normalize";

describe("normalizeAddress", () => {
  it("lowercases EVM addresses", () => {
    expect(normalizeAddress("0xABCDEF1234567890ABCDEF1234567890ABCDEF12")).toBe(
      "0xabcdef1234567890abcdef1234567890abcdef12"
    );
  });

  it("preserves Solana base58 case", () => {
    const solAddr = "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV";
    expect(normalizeAddress(solAddr)).toBe(solAddr);
  });

  it("trims whitespace on Solana addresses", () => {
    expect(normalizeAddress("  7EcDh  ")).toBe("7EcDh");
  });
});

describe("normalizeDomain", () => {
  it("strips protocol", () => {
    expect(normalizeDomain("https://example.com")).toBe("example.com");
    expect(normalizeDomain("http://example.com")).toBe("example.com");
  });

  it("strips www prefix", () => {
    expect(normalizeDomain("www.example.com")).toBe("example.com");
  });

  it("strips path", () => {
    expect(normalizeDomain("example.com/path/to/page")).toBe("example.com");
  });

  it("strips port", () => {
    expect(normalizeDomain("example.com:8080")).toBe("example.com");
  });

  it("lowercases", () => {
    expect(normalizeDomain("EXAMPLE.COM")).toBe("example.com");
  });
});

describe("buildDedupKey", () => {
  it("produces consistent SHA-256 hex", () => {
    const key1 = buildDedupKey("ADDRESS", "0xabc");
    const key2 = buildDedupKey("ADDRESS", "0xabc");
    expect(key1).toBe(key2);
    expect(key1).toHaveLength(64); // SHA-256 hex
  });

  it("different types produce different keys", () => {
    const k1 = buildDedupKey("ADDRESS", "0xabc");
    const k2 = buildDedupKey("CONTRACT", "0xabc");
    expect(k1).not.toBe(k2);
  });
});

describe("normalizeValue", () => {
  it("normalizes ADDRESS via normalizeAddress", () => {
    expect(normalizeValue("ADDRESS", "0xABC")).toBe("0xabc");
  });

  it("normalizes DOMAIN via normalizeDomain", () => {
    expect(normalizeValue("DOMAIN", "https://www.example.com/page")).toBe(
      "example.com"
    );
    // Uppercase www → lowercase happens after www strip, so www. stays if uppercase
    expect(normalizeValue("DOMAIN", "https://EXAMPLE.COM/page")).toBe(
      "example.com"
    );
  });

  it("trims PROJECT type", () => {
    expect(normalizeValue("PROJECT", "  My Project  ")).toBe("My Project");
  });
});
