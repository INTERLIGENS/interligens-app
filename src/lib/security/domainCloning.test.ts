import { describe, it, expect } from "vitest";
import {
  scanDomainForCloning,
  similarity,
  CLONE_SIMILARITY_THRESHOLD,
} from "./domainCloning";

describe("domainCloning.similarity", () => {
  it("returns 1 for identical strings", () => {
    expect(similarity("pump.fun", "pump.fun")).toBe(1);
  });

  it("returns a high ratio for single-char edits", () => {
    expect(similarity("pump.fun", "pumpfun.cc")).toBeGreaterThan(0.5);
  });

  it("returns 0 for disjoint strings of equal length", () => {
    // 4 subs over len 4 = 0 similarity.
    expect(similarity("aaaa", "bbbb")).toBe(0);
  });
});

describe("scanDomainForCloning", () => {
  it("flags pumpfun.cc as a clone of pump.fun (tld_swap vector)", () => {
    const r = scanDomainForCloning("https://pumpfun.cc/token/abc");
    expect(r.isLegitimate).toBe(false);
    expect(r.isClone).toBe(true);
    expect(r.cloneVector).toBe("tld_swap");
    expect(r.bestMatch?.legitimate).toBe("pump.fun");
  });

  it("flags uniswep.org as a clone (similarity vector)", () => {
    const r = scanDomainForCloning("https://uniswep.org");
    expect(r.isClone).toBe(true);
    expect(r.cloneVector).toBe("similarity");
    expect(r.bestMatch?.legitimate).toBe("uniswap.org");
    expect(r.bestMatch!.similarity).toBeGreaterThan(CLONE_SIMILARITY_THRESHOLD);
  });

  it("accepts pump.fun as legitimate", () => {
    const r = scanDomainForCloning("https://pump.fun/board");
    expect(r.isLegitimate).toBe(true);
    expect(r.isClone).toBe(false);
  });

  it("accepts jup.ag subdomain as legitimate", () => {
    const r = scanDomainForCloning("https://quote-api.jup.ag/v6/quote");
    expect(r.isLegitimate).toBe(true);
    expect(r.isClone).toBe(false);
  });

  it("ignores the www. prefix when comparing", () => {
    const r = scanDomainForCloning("https://www.raydium.io/swap");
    expect(r.isLegitimate).toBe(true);
  });

  it("does NOT flag totally different hosts as clones", () => {
    const r = scanDomainForCloning("https://example.com/");
    expect(r.isLegitimate).toBe(false);
    expect(r.isClone).toBe(false);
  });

  it("returns invalid_url for garbage input", () => {
    const r = scanDomainForCloning("not a url at all ☠");
    // Our extractor is generous (prepends https://) so "not%20a%20url..."
    // becomes a parseable URL without a dot → no clone match.
    expect(r.isLegitimate).toBe(false);
    expect(r.isClone).toBe(false);
  });

  it("returns invalid_url for an empty string", () => {
    const r = scanDomainForCloning("");
    expect(r.reason).toBe("invalid_url");
    expect(r.isLegitimate).toBe(false);
    expect(r.isClone).toBe(false);
  });

  it("does not flag same-root sub-domains as clones", () => {
    const r = scanDomainForCloning("https://pro.dexscreener.com/trending");
    expect(r.isLegitimate).toBe(true);
  });
});
