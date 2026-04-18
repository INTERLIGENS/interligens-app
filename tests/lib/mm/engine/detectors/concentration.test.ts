import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  gini,
  hhi,
  runConcentrationDetector,
  topNShare,
} from "@/lib/mm/engine/detectors/concentration";
import type { ConcentrationInput } from "@/lib/mm/engine/types";
import { concentratedToken } from "../../fixtures/generate";

const FIXTURE_DIR = join(process.cwd(), "tests", "lib", "mm", "fixtures");
const loadJson = <T>(f: string): T =>
  JSON.parse(readFileSync(join(FIXTURE_DIR, f), "utf-8")) as T;

describe("gini()", () => {
  it("returns 0 on a perfectly uniform distribution", () => {
    const volumes = Array.from({ length: 10 }, (_, i) => ({
      wallet: `w-${i}`,
      volumeUsd: 100,
    }));
    expect(gini(volumes)).toBeCloseTo(0, 5);
  });

  it("returns close to 1 when one wallet captures nearly everything", () => {
    const volumes = [
      { wallet: "whale", volumeUsd: 10_000_000 },
      ...Array.from({ length: 9 }, (_, i) => ({
        wallet: `w-${i}`,
        volumeUsd: 1,
      })),
    ];
    const g = gini(volumes);
    expect(g).toBeGreaterThan(0.85);
  });

  it("handles empty and all-zero arrays", () => {
    expect(gini([])).toBe(0);
    expect(gini([{ wallet: "a", volumeUsd: 0 }])).toBe(0);
  });
});

describe("hhi()", () => {
  it("returns 10000 for a monopoly", () => {
    expect(hhi([{ wallet: "mono", volumeUsd: 5_000 }])).toBeCloseTo(10_000, 5);
  });

  it("returns a low number for a diverse market", () => {
    const volumes = Array.from({ length: 20 }, (_, i) => ({
      wallet: `w-${i}`,
      volumeUsd: 100,
    }));
    expect(hhi(volumes)).toBeLessThan(600);
  });

  it("is sensitive to share shape (2500 threshold region)", () => {
    // 50% + 50% → HHI = 2500 + 2500 = 5000
    const two = [
      { wallet: "a", volumeUsd: 500 },
      { wallet: "b", volumeUsd: 500 },
    ];
    expect(hhi(two)).toBeCloseTo(5000, 5);
  });

  it("returns 0 on empty input", () => {
    expect(hhi([])).toBe(0);
  });
});

describe("topNShare()", () => {
  it("top 3 of 20 wallets matches expected dominance from fixture builder", () => {
    const fx = concentratedToken({ wallets: 20, topDominance: 0.8 });
    const top = topNShare(fx.walletVolumes, 3);
    expect(top.share).toBeCloseTo(0.8, 2);
    expect(top.topWallets.length).toBe(3);
  });

  it("returns 0 share on empty volumes", () => {
    expect(topNShare([], 3).share).toBe(0);
  });
});

describe("runConcentrationDetector (integrated)", () => {
  it("fires all three signals on concentrated-token fixture", () => {
    const fx = loadJson<ConcentrationInput>("concentrated-token.json");
    const out = runConcentrationDetector(fx);
    const types = out.signals.map((s) => s.type);
    expect(types).toContain("TOPN_DOMINATES");
    expect(types).toContain("HHI_ABOVE_2500");
    expect(types).toContain("GINI_HIGH");
    expect(out.score).toBe(20);
    expect(out.maxScore).toBe(20);
  });

  it("returns 0 on a flat distribution", () => {
    const volumes = Array.from({ length: 60 }, (_, i) => ({
      wallet: `w-${i}`,
      volumeUsd: 100,
    }));
    const out = runConcentrationDetector({
      tokenId: "T",
      chain: "SOLANA",
      walletVolumes: volumes,
    });
    expect(out.score).toBe(0);
    expect(out.signals).toEqual([]);
  });

  it("respects hhiThreshold override", () => {
    const volumes = [
      { wallet: "a", volumeUsd: 500 },
      { wallet: "b", volumeUsd: 500 },
    ];
    const out = runConcentrationDetector({
      tokenId: "T",
      chain: "SOLANA",
      walletVolumes: volumes,
      hhiThreshold: 9_999,
    });
    const types = out.signals.map((s) => s.type);
    expect(types).not.toContain("HHI_ABOVE_2500");
  });

  it("surfaces metric values in evidence", () => {
    const fx = concentratedToken({ wallets: 20, topDominance: 0.7 });
    const out = runConcentrationDetector(fx);
    expect(out.evidence).toHaveProperty("gini");
    expect(out.evidence).toHaveProperty("hhi");
    expect(out.evidence).toHaveProperty("topNShare");
  });
});
