import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock setup ───────────────────────────────────────────────────────────
// computeMmRiskAssessment is the seam. We control its behaviour (resolve,
// reject, slow) and assert on the outer contract of getMmRiskForToken.

const computeMmRiskAssessment = vi.fn();
vi.mock("@/lib/mm/adapter/riskAssessment", () => ({
  computeMmRiskAssessment: (...args: unknown[]) =>
    computeMmRiskAssessment(...args),
}));

import {
  getMmRiskForToken,
  isMmScanBlockEnabled,
  MM_SCAN_TIMEOUT_MS,
} from "@/lib/scan/mmScanIntegration";

// ─── Env management ───────────────────────────────────────────────────────

const ORIGINAL_FLAG = process.env.MM_SCAN_BLOCK_LIVE;

function setFlag(v: "true" | "false" | undefined) {
  if (v === undefined) delete process.env.MM_SCAN_BLOCK_LIVE;
  else process.env.MM_SCAN_BLOCK_LIVE = v;
}

beforeEach(() => {
  computeMmRiskAssessment.mockReset();
  setFlag("true");
  vi.useRealTimers();
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.MM_SCAN_BLOCK_LIVE;
  else process.env.MM_SCAN_BLOCK_LIVE = ORIGINAL_FLAG;
});

// ─── Fixture ──────────────────────────────────────────────────────────────

function fakeAssessment() {
  return {
    overall: {
      displayScore: 40,
      band: "YELLOW",
      dominantDriver: "BEHAVIORAL",
      displayReason: "BEHAVIORAL_PATTERN_MEDIUM",
      disclaimer: "stub",
      freshness: { computedAt: new Date().toISOString(), ageMinutes: 0, staleness: "fresh" },
    },
    engine: {},
    registry: { entity: null, attribution: null, registryDrivenScore: 0 },
    subjectType: "TOKEN",
    subjectId: "0xabc",
    chain: "ETHEREUM",
    scanRunId: "run_1",
    schemaVersion: 1,
    computedAt: new Date().toISOString(),
    source: "compute",
  };
}

describe("mmScanIntegration", () => {
  it("returns null when MM_SCAN_BLOCK_LIVE is absent (flag off by default)", async () => {
    setFlag(undefined);
    expect(isMmScanBlockEnabled()).toBe(false);
    const r = await getMmRiskForToken("0xabc", "eth");
    expect(r).toBeNull();
    expect(computeMmRiskAssessment).not.toHaveBeenCalled();
  });

  it("returns null when MM_SCAN_BLOCK_LIVE=false", async () => {
    setFlag("false");
    expect(isMmScanBlockEnabled()).toBe(false);
    const r = await getMmRiskForToken("0xabc", "eth");
    expect(r).toBeNull();
    expect(computeMmRiskAssessment).not.toHaveBeenCalled();
  });

  it("hits computeMmRiskAssessment with normalised chain when flag is on", async () => {
    computeMmRiskAssessment.mockResolvedValue(fakeAssessment());
    const r = await getMmRiskForToken("  0xabc  ", "sol");
    expect(r).not.toBeNull();
    expect(computeMmRiskAssessment).toHaveBeenCalledTimes(1);
    const call = computeMmRiskAssessment.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.chain).toBe("SOLANA");
    expect(call.subjectId).toBe("0xabc");
    expect(call.subjectType).toBe("TOKEN");
    expect(call.useCache).toBe(true);
    expect(call.maxAgeHours).toBe(6);
  });

  it("returns null on unknown chain without calling the adapter", async () => {
    const r = await getMmRiskForToken("0xabc", "does-not-exist");
    expect(r).toBeNull();
    expect(computeMmRiskAssessment).not.toHaveBeenCalled();
  });

  it("returns null when the adapter throws (fail-silent)", async () => {
    computeMmRiskAssessment.mockRejectedValue(new Error("api_down"));
    const r = await getMmRiskForToken("0xabc", "eth");
    expect(r).toBeNull();
  });

  it("enforces the hard timeout (no race unwind past MM_SCAN_TIMEOUT_MS)", async () => {
    // Adapter resolves AFTER the timeout budget — integration must bail.
    vi.useFakeTimers();
    const later = new Promise((resolve) => {
      setTimeout(() => resolve(fakeAssessment()), MM_SCAN_TIMEOUT_MS + 1_000);
    });
    computeMmRiskAssessment.mockImplementation(() => later);
    const pending = getMmRiskForToken("0xabc", "eth");
    vi.advanceTimersByTime(MM_SCAN_TIMEOUT_MS + 10);
    const r = await pending;
    expect(r).toBeNull();
  });

  it("returns null on empty / whitespace address", async () => {
    const r1 = await getMmRiskForToken("", "eth");
    const r2 = await getMmRiskForToken("   ", "eth");
    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(computeMmRiskAssessment).not.toHaveBeenCalled();
  });
});
