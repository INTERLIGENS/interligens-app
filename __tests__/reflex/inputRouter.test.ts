import { describe, it, expect } from "vitest";
import { classify } from "@/lib/reflex/inputRouter";
import { MAX_INPUT_LENGTH } from "@/lib/reflex/constants";

describe("inputRouter: SOLANA_TOKEN — valid base58 32-44 chars", () => {
  it.each([
    "So11111111111111111111111111111111111111112",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
  ])("classifies %s as SOLANA_TOKEN", (addr) => {
    const r = classify(addr);
    expect(r.type).toBe("SOLANA_TOKEN");
    expect(r.chain).toBe("sol");
    expect(r.address).toBe(addr);
    expect(r.raw).toBe(addr);
  });
});

describe("inputRouter: SOLANA_TOKEN invalid shapes are not SOLANA_TOKEN", () => {
  it.each([
    ["0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl", "contains 0/O/I/l (excluded from base58)"],
    ["A".repeat(31), "31 chars (below 32 minimum)"],
    ["A".repeat(45), "45 chars (above 44 maximum)"],
    ["short_with_underscore_xyz", "underscores not in base58 alphabet"],
    ["address with spaces abcdefghijklmnopqrst", "contains spaces"],
  ])("does not classify %j (%s) as SOLANA_TOKEN", (s) => {
    expect(classify(s).type).not.toBe("SOLANA_TOKEN");
  });
});

describe("inputRouter: EVM_TOKEN — valid 0x + 40 hex", () => {
  it.each([
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "0x0000000000000000000000000000000000000000",
    "0xffffffffffffffffffffffffffffffffffffffff",
    "0xabcdef1234567890abcdef1234567890abcdef12",
  ])("classifies %s as EVM_TOKEN, address lowercased", (addr) => {
    const r = classify(addr);
    expect(r.type).toBe("EVM_TOKEN");
    expect(r.chain).toBe("evm");
    expect(r.address).toBe(addr.toLowerCase());
  });
});

describe("inputRouter: EVM_TOKEN invalid shapes are not EVM_TOKEN", () => {
  it.each([
    "0xshort",
    "0x" + "f".repeat(41),
    "0x" + "f".repeat(39),
    "0xG" + "f".repeat(39),
    "00xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  ])("rejects %s as EVM_TOKEN", (s) => {
    expect(classify(s).type).not.toBe("EVM_TOKEN");
  });
});

describe("inputRouter: URL — scheme + schemeless", () => {
  it.each([
    ["https://interligens.com", "https://interligens.com"],
    ["http://example.io", "http://example.io"],
    ["https://x.com/elonmusk", "https://x.com/elonmusk"],
    ["interligens.com", "https://interligens.com"],
    ["sub.domain.example.io", "https://sub.domain.example.io"],
    ["interligens.com/path?q=1", "https://interligens.com/path?q=1"],
  ])("classifies %s as URL → %s", (input, normalized) => {
    const r = classify(input);
    expect(r.type).toBe("URL");
    expect(r.url).toBe(normalized);
  });
});

describe("inputRouter: URL false-positive guards", () => {
  it.each([
    "1.2.3.4",
    "1234.5678",
    "hello world",
    "@interligens",
    "no_dots_here",
  ])("does not misclassify %j as URL", (s) => {
    expect(classify(s).type).not.toBe("URL");
  });
});

describe("inputRouter: X_HANDLE — valid", () => {
  it.each([
    ["@interligens", "interligens"],
    ["@elonmusk", "elonmusk"],
    ["@DonWedge", "donwedge"],
    ["@bk_okoski", "bk_okoski"],
    ["@a", "a"],
    ["@abcdefghijklmno", "abcdefghijklmno"], // 15 chars max
    ["@INTERLIGENS", "interligens"],
  ])("classifies %s as X_HANDLE → %s", (input, normalized) => {
    const r = classify(input);
    expect(r.type).toBe("X_HANDLE");
    expect(r.handle).toBe(normalized);
  });
});

describe("inputRouter: X_HANDLE — invalid", () => {
  it.each([
    "@",                            // empty handle
    "@" + "a".repeat(16),            // over 15-char limit
    "@with-dash",                   // dash not allowed by X
    "@user name",                   // contains space
    "@user.name",                   // dot not allowed
    "elonmusk",                     // missing @
  ])("rejects %j as X_HANDLE", (s) => {
    expect(classify(s).type).not.toBe("X_HANDLE");
  });
});

describe("inputRouter: TRON WALLET", () => {
  it.each([
    "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
    "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7",
  ])("classifies %s as WALLET chain=tron", (addr) => {
    const r = classify(addr);
    expect(r.type).toBe("WALLET");
    expect(r.chain).toBe("tron");
    expect(r.address).toBe(addr);
  });
});

describe("inputRouter: TICKER — valid", () => {
  it.each([
    ["BTC", "BTC"],
    ["ETH", "ETH"],
    ["BOTIFY", "BOTIFY"],
    ["$BTC", "BTC"],
    ["$BOTIFY", "BOTIFY"],
    ["sol", "SOL"],
    ["m2", "M2"],
    ["aaaaaaaaaa", "AAAAAAAAAA"], // 10 chars max
  ])("classifies %s as TICKER → %s", (input, normalized) => {
    const r = classify(input);
    expect(r.type).toBe("TICKER");
    expect(r.ticker).toBe(normalized);
  });
});

describe("inputRouter: TICKER — invalid shapes", () => {
  it.each([
    "$",                          // empty after $
    "$$BTC",                      // double $
    "a".repeat(11),                // 11 chars (over limit)
    "$1BTC",                      // starts with digit after $
    "BTC-PERP",                   // dash
    "B TC",                       // space
  ])("rejects %j as TICKER", (s) => {
    expect(classify(s).type).not.toBe("TICKER");
  });
});

describe("inputRouter: UNKNOWN / garbage", () => {
  it.each([
    "",
    "   ",
    "💩",
    "a",                          // 1 char — below TICKER min of 2
    "1234",                       // digits only — TICKER needs alpha first
    "this is not an address",
  ])("classifies %j as UNKNOWN", (s) => {
    expect(classify(s).type).toBe("UNKNOWN");
  });
});

describe("inputRouter: whitespace handling", () => {
  it("trims surrounding whitespace before classification", () => {
    const r = classify("  @interligens  ");
    expect(r.type).toBe("X_HANDLE");
    expect(r.handle).toBe("interligens");
  });
  it("preserves raw input verbatim including whitespace", () => {
    const padded = "  0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48  ";
    const r = classify(padded);
    expect(r.raw).toBe(padded);
    expect(r.type).toBe("EVM_TOKEN");
    expect(r.address).toBe("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
  });
});

describe("inputRouter: case sensitivity", () => {
  it("lowercases EVM address for canonical storage", () => {
    const r = classify("0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48");
    expect(r.address).toBe("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
  });
  it("preserves Solana address case (base58 is case-sensitive)", () => {
    const addr = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    expect(classify(addr).address).toBe(addr);
  });
  it("lowercases X handle for canonical storage", () => {
    expect(classify("@INTERLIGENS").handle).toBe("interligens");
  });
});

describe("inputRouter: max input length guard", () => {
  it("rejects inputs longer than MAX_INPUT_LENGTH as UNKNOWN", () => {
    const huge = "a".repeat(MAX_INPUT_LENGTH + 1);
    expect(classify(huge).type).toBe("UNKNOWN");
  });
  it("accepts inputs exactly at MAX_INPUT_LENGTH (when shape matches)", () => {
    // URL of length MAX_INPUT_LENGTH ending with a real TLD
    const long = "a".repeat(MAX_INPUT_LENGTH - 8) + ".example";
    expect(long.length).toBe(MAX_INPUT_LENGTH);
    expect(classify(long).type).toBe("URL");
  });
});

describe("inputRouter: non-string input is safely coerced", () => {
  it("treats null as UNKNOWN", () => {
    // @ts-expect-error intentional misuse
    expect(classify(null).type).toBe("UNKNOWN");
  });
  it("treats undefined as UNKNOWN", () => {
    // @ts-expect-error intentional misuse
    expect(classify(undefined).type).toBe("UNKNOWN");
  });
});

describe("inputRouter: precedence — TRON before Solana on 34-char base58", () => {
  it("a T-prefixed 34-char base58 string is WALLET tron, not SOLANA_TOKEN", () => {
    const tronShaped = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
    expect(tronShaped.length).toBe(34);
    const r = classify(tronShaped);
    expect(r.type).toBe("WALLET");
    expect(r.chain).toBe("tron");
  });
});

describe("inputRouter: precedence — X_HANDLE before TICKER on @-prefixed input", () => {
  it("@BTC is X_HANDLE, not TICKER", () => {
    const r = classify("@BTC");
    expect(r.type).toBe("X_HANDLE");
    expect(r.handle).toBe("btc");
  });
});
