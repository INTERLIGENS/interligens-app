import { describe, it, expect } from "vitest";
import {
  KNOWN_ROUTERS,
  KNOWN_ROUTERS_SET,
  isKnownRouter,
  routerInfo,
  type RouterCategory,
} from "../known-routers";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const CATEGORIES: RouterCategory[] = [
  "cex_router",
  "dex_aggregator",
  "amm_program",
  "market_maker",
  "mev_bot_known",
];
const OKX = "ARu4n5mFdZogZAravu7CcizaojWnS6oqka37gdLT5SZn";

describe("known-routers blacklist", () => {
  it("is populated", () => {
    expect(KNOWN_ROUTERS.length).toBeGreaterThan(0);
  });

  it("every entry is well-formed (base58 wallet, label, valid category, sourceUrl)", () => {
    for (const r of KNOWN_ROUTERS) {
      expect(r.wallet, `${r.label}: wallet`).toMatch(BASE58);
      expect(r.label.trim().length, `${r.wallet}: label`).toBeGreaterThan(0);
      expect(CATEGORIES, `${r.wallet}: category`).toContain(r.category);
      expect(r.sourceUrl, `${r.wallet}: sourceUrl`).toMatch(/^https?:\/\//);
    }
  });

  it("has no duplicate wallets", () => {
    const wallets = KNOWN_ROUTERS.map((r) => r.wallet);
    expect(KNOWN_ROUTERS_SET.size).toBe(wallets.length);
    expect(new Set(wallets).size).toBe(wallets.length);
  });

  it("includes the OKX Router false positive and looks it up", () => {
    expect(isKnownRouter(OKX)).toBe(true);
    expect(KNOWN_ROUTERS_SET.has(OKX)).toBe(true);
    expect(routerInfo(OKX)?.category).toBe("cex_router");
  });

  it("does not match an ordinary wallet", () => {
    expect(isKnownRouter("So11111111111111111111111111111111111111112")).toBe(false);
    expect(routerInfo("nope")).toBeUndefined();
  });
});
