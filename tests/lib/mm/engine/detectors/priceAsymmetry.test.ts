import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  computeAsymmetry,
  runPriceAsymmetryDetector,
} from "@/lib/mm/engine/detectors/priceAsymmetry";
import type { PriceAsymmetryInput } from "@/lib/mm/engine/types";
import { asymmetricPriceToken } from "../../fixtures/generate";

const FIXTURE_DIR = join(process.cwd(), "tests", "lib", "mm", "fixtures");
const loadJson = <T>(f: string): T =>
  JSON.parse(readFileSync(join(FIXTURE_DIR, f), "utf-8")) as T;

const NOW = 1_700_000_000;

describe("computeAsymmetry", () => {
  it("ignores moves outside the window", () => {
    const m = computeAsymmetry(
      [
        { timestamp: NOW - 365 * 86_400, priceChangePct: 5, volumeUsd: 100_000 },
        { timestamp: NOW - 3_600, priceChangePct: 2, volumeUsd: 1_000 },
      ],
      30 * 86_400,
      NOW,
    );
    expect(m.moveCount).toBe(1);
    expect(m.upVolumeUsd).toBe(1_000);
  });

  it("classifies neutral moves (|pct| < 1%)", () => {
    const m = computeAsymmetry(
      [
        { timestamp: NOW, priceChangePct: 0.4, volumeUsd: 500 },
        { timestamp: NOW, priceChangePct: 1.5, volumeUsd: 1_000 },
      ],
      3_600,
      NOW,
    );
    expect(m.upVolumeUsd).toBe(1_000);
    expect(m.neutralVolumeUsd).toBe(500);
    expect(m.downVolumeUsd).toBe(0);
  });

  it("returns Infinity when there are only up-moves", () => {
    const m = computeAsymmetry(
      [{ timestamp: NOW, priceChangePct: 2, volumeUsd: 100 }],
      3_600,
      NOW,
    );
    expect(m.ratio).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("runPriceAsymmetryDetector", () => {
  it("fires PRICE_ASYMMETRY on the asymmetric fixture (ratio > 3)", () => {
    const fx = loadJson<PriceAsymmetryInput>("asymmetric-price-token.json");
    const out = runPriceAsymmetryDetector(fx);
    const types = out.signals.map((s) => s.type);
    expect(types).toContain("PRICE_ASYMMETRY");
    expect(out.maxScore).toBe(8);
    expect(out.detectorType).toBe("PRICE_ASYMMETRY");
  });

  it("emits corroborativeOnly=true and score=0 before co-occurrence gate", () => {
    const fx = asymmetricPriceToken({ upDownRatio: 6, days: 30 });
    const out = runPriceAsymmetryDetector(fx);
    expect(out.score).toBe(0);
    expect((out.evidence as { corroborativeOnly: boolean }).corroborativeOnly).toBe(
      true,
    );
    expect(
      (out.evidence as { scoreIfCoOccurrent: number }).scoreIfCoOccurrent,
    ).toBe(8);
  });

  it("no signal when ratio below threshold", () => {
    const out = runPriceAsymmetryDetector({
      tokenId: "T",
      chain: "SOLANA",
      moves: [
        { timestamp: NOW - 3_600, priceChangePct: 1.5, volumeUsd: 1_000 },
        { timestamp: NOW - 3_600, priceChangePct: -1.5, volumeUsd: 900 },
      ],
      nowSeconds: NOW,
    });
    expect(out.signals.length).toBe(0);
    expect(
      (out.evidence as { scoreIfCoOccurrent: number }).scoreIfCoOccurrent,
    ).toBe(0);
  });

  it("no signal on empty move list", () => {
    const out = runPriceAsymmetryDetector({
      tokenId: "T",
      chain: "SOLANA",
      moves: [],
      nowSeconds: NOW,
    });
    expect(out.signals).toEqual([]);
  });

  it("custom ratioThreshold overrides default", () => {
    const out = runPriceAsymmetryDetector({
      tokenId: "T",
      chain: "SOLANA",
      moves: [
        { timestamp: NOW, priceChangePct: 2, volumeUsd: 2_000 },
        { timestamp: NOW, priceChangePct: -2, volumeUsd: 1_000 },
      ],
      ratioThreshold: 1.5,
      nowSeconds: NOW,
    });
    expect(out.signals.length).toBeGreaterThan(0);
  });

  it("exposes window bounds in evidence", () => {
    const out = runPriceAsymmetryDetector({
      tokenId: "T",
      chain: "SOLANA",
      moves: [],
      nowSeconds: NOW,
      windowSeconds: 86_400,
    });
    const ev = out.evidence as { windowStart: number; windowEnd: number };
    expect(ev.windowEnd).toBe(NOW);
    expect(ev.windowStart).toBe(NOW - 86_400);
  });
});
