import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/off-chain-credibility/engine", () => ({
  computeOffChainCredibility: vi.fn(),
}));

import {
  computeOffChainCredibility,
  type OffChainResult,
} from "@/lib/off-chain-credibility/engine";
import { runOffChain } from "@/lib/reflex/adapters/offchain";
import type { ReflexResolvedInput } from "@/lib/reflex/types";

const mockEngine = vi.mocked(computeOffChainCredibility);

const SAMPLE_INPUT: ReflexResolvedInput = {
  type: "URL",
  url: "https://example.com",
  raw: "https://example.com",
};

function fakeResult(over: Partial<OffChainResult>): OffChainResult {
  return {
    score: 50,
    band: "MIXED",
    confidence: "MEDIUM",
    tiger_modifier: 0,
    signals: [],
    summary_en: "neutral",
    summary_fr: "neutre",
    computed_at: new Date(),
    cache_until: new Date(Date.now() + 86_400_000),
    domainAgeDays: 365,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("offchain adapter", () => {
  it("emits STRONG severity signal for VERY_LOW band", async () => {
    mockEngine.mockResolvedValue(fakeResult({ band: "VERY_LOW" }));
    const r = await runOffChain({ resolvedInput: SAMPLE_INPUT, offChainInput: {} });
    expect(r.signals).toHaveLength(1);
    expect(r.signals[0].severity).toBe("STRONG");
    expect(r.signals[0].code).toBe("offchain.band.very_low");
  });

  it("emits MODERATE severity for LOW band", async () => {
    mockEngine.mockResolvedValue(fakeResult({ band: "LOW" }));
    const r = await runOffChain({ resolvedInput: SAMPLE_INPUT, offChainInput: {} });
    expect(r.signals[0].severity).toBe("MODERATE");
  });

  it("emits WEAK severity for MIXED band", async () => {
    mockEngine.mockResolvedValue(fakeResult({ band: "MIXED" }));
    const r = await runOffChain({ resolvedInput: SAMPLE_INPUT, offChainInput: {} });
    expect(r.signals[0].severity).toBe("WEAK");
  });

  it("emits no signal for GOOD or STRONG bands", async () => {
    mockEngine.mockResolvedValue(fakeResult({ band: "GOOD" }));
    const r1 = await runOffChain({ resolvedInput: SAMPLE_INPUT, offChainInput: {} });
    expect(r1.signals).toHaveLength(0);

    mockEngine.mockResolvedValue(fakeResult({ band: "STRONG" }));
    const r2 = await runOffChain({ resolvedInput: SAMPLE_INPUT, offChainInput: {} });
    expect(r2.signals).toHaveLength(0);
  });

  it("returns ran:false + error when engine rejects", async () => {
    mockEngine.mockRejectedValue(new Error("fetch failed"));
    const r = await runOffChain({ resolvedInput: SAMPLE_INPUT, offChainInput: {} });
    expect(r.ran).toBe(false);
    expect(r.error).toBe("fetch failed");
  });
});
