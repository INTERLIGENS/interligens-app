import { describe, it, expect } from "vitest";
import {
  PROCEEDS_POLICY,
  getCashoutConfidence,
  isCashoutDocumented,
  isCashoutObserved,
  getExclusionReason,
} from "./policy";

describe("PROCEEDS_POLICY constants", () => {
  it("version is 1.0.0", () => {
    expect(PROCEEDS_POLICY.version).toBe("1.0.0");
  });
  it("MIN_CASHOUT_USD is 10", () => {
    expect(PROCEEDS_POLICY.MIN_CASHOUT_USD).toBe(10);
  });
  it("CEX_DEPOSIT_CONFIDENCE is documented", () => {
    expect(PROCEEDS_POLICY.CEX_DEPOSIT_CONFIDENCE).toBe("documented");
  });
  it("BRIDGE_CONFIDENCE is observed", () => {
    expect(PROCEEDS_POLICY.BRIDGE_CONFIDENCE).toBe("observed");
  });
});

describe("getCashoutConfidence", () => {
  it("cex_deposit → documented", () => {
    expect(getCashoutConfidence("cex_deposit")).toBe("documented");
  });
  it("jupiter_swap → documented", () => {
    expect(getCashoutConfidence("jupiter_swap")).toBe("documented");
  });
  it("raydium_swap → documented", () => {
    expect(getCashoutConfidence("raydium_swap")).toBe("documented");
  });
  it("dex_sell → documented", () => {
    expect(getCashoutConfidence("dex_sell")).toBe("documented");
  });
  it("TRADE → documented", () => {
    expect(getCashoutConfidence("TRADE")).toBe("documented");
  });
  it("SUMMARY_ARKHAM → documented", () => {
    expect(getCashoutConfidence("SUMMARY_ARKHAM")).toBe("documented");
  });
  it("bridge → observed", () => {
    expect(getCashoutConfidence("bridge")).toBe("observed");
  });
  it("large_transfer → observed", () => {
    expect(getCashoutConfidence("large_transfer")).toBe("observed");
  });
  it("swap (ambiguous) → excluded", () => {
    expect(getCashoutConfidence("swap")).toBe("excluded");
  });
  it("buy → excluded", () => {
    expect(getCashoutConfidence("buy")).toBe("excluded");
  });
  it("lp_deposit → excluded", () => {
    expect(getCashoutConfidence("lp_deposit")).toBe("excluded");
  });
  it("nft_mint → excluded", () => {
    expect(getCashoutConfidence("nft_mint")).toBe("excluded");
  });
  it("staking → excluded", () => {
    expect(getCashoutConfidence("staking")).toBe("excluded");
  });
  it("unknown_type → excluded (fail-closed)", () => {
    expect(getCashoutConfidence("unknown_type")).toBe("excluded");
  });
});

describe("isCashoutDocumented", () => {
  it("cex_deposit $500 → true", () => {
    expect(isCashoutDocumented("cex_deposit", 500)).toBe(true);
  });
  it("jupiter_swap $10 (exact minimum) → true", () => {
    expect(isCashoutDocumented("jupiter_swap", 10)).toBe(true);
  });
  it("dex_sell $9.99 (below min) → false", () => {
    expect(isCashoutDocumented("dex_sell", 9.99)).toBe(false);
  });
  it("bridge $50K → false (observed, not documented)", () => {
    expect(isCashoutDocumented("bridge", 50_000)).toBe(false);
  });
  it("buy $1000 → false", () => {
    expect(isCashoutDocumented("buy", 1000)).toBe(false);
  });
  it("null amount → false", () => {
    expect(isCashoutDocumented("cex_deposit", null)).toBe(false);
  });
  it("swap (ambiguous) $500 → false", () => {
    expect(isCashoutDocumented("swap", 500)).toBe(false);
  });
});

describe("isCashoutObserved", () => {
  it("bridge $15K → true", () => {
    expect(isCashoutObserved("bridge", 15_000)).toBe(true);
  });
  it("large_transfer $50K → true", () => {
    expect(isCashoutObserved("large_transfer", 50_000)).toBe(true);
  });
  it("cex_deposit $500 → false (documented, not observed)", () => {
    expect(isCashoutObserved("cex_deposit", 500)).toBe(false);
  });
  it("buy $500 → false (excluded)", () => {
    expect(isCashoutObserved("buy", 500)).toBe(false);
  });
  it("bridge $5 (below min) → false", () => {
    expect(isCashoutObserved("bridge", 5)).toBe(false);
  });
});

describe("getExclusionReason", () => {
  it("null amount → zero or null amount", () => {
    expect(getExclusionReason("cex_deposit", null)).toContain("zero or null");
  });
  it("below min → below MIN_CASHOUT_USD", () => {
    expect(getExclusionReason("dex_sell", 5)).toContain("below MIN_CASHOUT_USD");
  });
  it("bridge → observed reason", () => {
    expect(getExclusionReason("bridge", 100)).toContain("observed");
  });
  it("staking → excluded reason", () => {
    expect(getExclusionReason("staking", 100)).toContain("excluded by policy");
  });
});
