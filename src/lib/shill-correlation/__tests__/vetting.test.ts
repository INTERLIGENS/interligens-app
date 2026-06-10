import { describe, it, expect } from "vitest";
import { classifyWalletProfile, VET_THRESHOLDS } from "../vetting";
import type { WalletProfile } from "../wallet-profile";

function profile(p: Partial<WalletProfile>): WalletProfile {
  return {
    wallet: "W",
    txCount30d: 10,
    sampleSize: 10,
    sampleSaturated: false,
    sampleSpanDays: 200,
    distinctTokenAccounts: 5,
    infraHits: [],
    heliusCalls: 3,
    ...p,
  };
}

describe("classifyWalletProfile", () => {
  it("passes a plausible human wallet (survives)", () => {
    const v = classifyWalletProfile(profile({ txCount30d: 40, distinctTokenAccounts: 8 }));
    expect(v.excludedReason).toBeNull();
    expect(v.flags).toEqual([]);
  });

  it("flags high_frequency at/above the threshold", () => {
    const v = classifyWalletProfile(
      profile({ txCount30d: VET_THRESHOLDS.highFrequencyTx30d }),
    );
    expect(v.flags).toContain("high_frequency");
    expect(v.excludedReason).toBe("high_frequency");
  });

  it("does not flag just below the frequency threshold", () => {
    const v = classifyWalletProfile(
      profile({ txCount30d: VET_THRESHOLDS.highFrequencyTx30d - 1 }),
    );
    expect(v.excludedReason).toBeNull();
  });

  it("flags too_many_tokens strictly above the threshold", () => {
    expect(
      classifyWalletProfile(profile({ distinctTokenAccounts: VET_THRESHOLDS.manyTokenAccounts }))
        .excludedReason,
    ).toBeNull();
    expect(
      classifyWalletProfile(profile({ distinctTokenAccounts: VET_THRESHOLDS.manyTokenAccounts + 1 }))
        .flags,
    ).toContain("too_many_tokens");
  });

  it("flags bot_infra on any infra hit", () => {
    const v = classifyWalletProfile(profile({ infraHits: ["Jito Tip Payment Program"] }));
    expect(v.flags).toContain("bot_infra");
  });

  it("records every matched flag; reason takes the highest-precedence one", () => {
    const v = classifyWalletProfile(
      profile({ txCount30d: 5000, distinctTokenAccounts: 300, infraHits: ["Jito"] }),
    );
    expect(v.flags).toEqual(["high_frequency", "too_many_tokens", "bot_infra"]);
    expect(v.excludedReason).toBe("high_frequency");
  });
});
