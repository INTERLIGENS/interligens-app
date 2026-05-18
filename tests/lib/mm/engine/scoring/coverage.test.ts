import { describe, it, expect } from "vitest";
import {
  computeCoverage,
  coverageReasons,
} from "@/lib/mm/engine/scoring/coverage";
import type { ScanRunInput } from "@/lib/mm/engine/types";

function withAllInputs(): ScanRunInput {
  return {
    subjectType: "WALLET",
    subjectId: "w",
    chain: "SOLANA",
    walletAgeDays: 90,
    washTrading: {
      tokenId: "T",
      chain: "SOLANA",
      txs: Array.from({ length: 200 }, (_, i) => ({
        hash: `h-${i}`,
        buyer: "b",
        seller: "s",
        tokenId: "T",
        volumeUsd: 100,
        side: "BUY",
        block: i,
        timestamp: i,
      })),
    },
    cluster: {
      targetWallet: "w",
      chain: "SOLANA",
      fundingEdges: Array.from({ length: 30 }, (_, i) => ({
        hash: `f-${i}`,
        from: "root",
        to: `d-${i}`,
        amountUsd: 10,
        block: i,
        timestamp: i,
      })),
      tokenActivity: [],
    },
    concentration: {
      tokenId: "T",
      chain: "SOLANA",
      walletVolumes: Array.from({ length: 30 }, (_, i) => ({
        wallet: `w-${i}`,
        volumeUsd: 100,
      })),
    },
  };
}

describe("computeCoverage", () => {
  it("all inputs present & ≥ thresholds → high", () => {
    expect(computeCoverage(withAllInputs())).toBe("high");
  });

  it("no inputs at all → low", () => {
    expect(
      computeCoverage({
        subjectType: "WALLET",
        subjectId: "w",
        chain: "SOLANA",
      }),
    ).toBe("low");
  });

  it("partial inputs → medium", () => {
    const base = withAllInputs();
    const cropped: ScanRunInput = {
      ...base,
      cluster: undefined,
      walletAgeDays: 2, // under threshold
    };
    expect(computeCoverage(cropped)).toBe("medium");
  });
});

describe("coverageReasons", () => {
  it("lists all missing sources", () => {
    const r = coverageReasons({
      subjectType: "WALLET",
      subjectId: "w",
      chain: "SOLANA",
    });
    expect(r).toEqual(
      expect.arrayContaining([
        "no_wash_trading_input",
        "no_cluster_input",
        "no_concentration_input",
        "wallet_age_unknown",
      ]),
    );
  });
});
