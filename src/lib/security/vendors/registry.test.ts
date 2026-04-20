import { describe, it, expect } from "vitest";
import { VENDOR_REGISTRY } from "./registry";

describe("VENDOR_REGISTRY", () => {
  it("has unique slugs", () => {
    const slugs = VENDOR_REGISTRY.map((v) => v.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every entry has a non-empty name and category", () => {
    for (const v of VENDOR_REGISTRY) {
      expect(v.slug).toBeTruthy();
      expect(v.name).toBeTruthy();
      expect(v.category).toBeTruthy();
    }
  });

  it("all statusPageUrl values are HTTPS", () => {
    for (const v of VENDOR_REGISTRY) {
      if (v.statusPageUrl) {
        expect(v.statusPageUrl.startsWith("https://")).toBe(true);
      }
    }
  });

  it("includes the critical V1 vendors", () => {
    const slugs = new Set(VENDOR_REGISTRY.map((v) => v.slug));
    for (const required of [
      "vercel",
      "cloudflare",
      "cloudflare-r2",
      "neon",
      "github",
      "npm",
      "prisma",
      "nextjs",
      "resend",
      "helius",
      "etherscan",
      "anthropic",
      "x-twitter",
      "upstash",
    ]) {
      expect(slugs.has(required)).toBe(true);
    }
  });
});
