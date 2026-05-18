import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/intelligence", () => ({
  lookupValue: vi.fn(),
}));

import { lookupValue } from "@/lib/intelligence";
import { runIntelligenceOverlay } from "@/lib/reflex/adapters/intelligenceOverlay";
import type { ReflexResolvedInput } from "@/lib/reflex/types";

const mockLookup = vi.mocked(lookupValue);

const SAMPLE_INPUT: ReflexResolvedInput = {
  type: "EVM_TOKEN",
  chain: "evm",
  address: "0xabc",
  raw: "0xabc",
};

const NO_MATCH = {
  ims: 0,
  ics: 0,
  matchCount: 0,
  hasSanction: false,
  topRiskClass: null,
  matchBasis: null,
  sourceSlug: null,
  externalUrl: null,
  winner: null,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("intelligenceOverlay adapter", () => {
  it("does not run when no address is present", async () => {
    const r = await runIntelligenceOverlay({ type: "X_HANDLE", handle: "x", raw: "@x" });
    expect(r.ran).toBe(false);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("emits no signal when matchCount=0", async () => {
    mockLookup.mockResolvedValue(NO_MATCH);
    const r = await runIntelligenceOverlay(SAMPLE_INPUT);
    expect(r.ran).toBe(true);
    expect(r.signals).toHaveLength(0);
  });

  it("emits CRITICAL + stopTrigger=true when hasSanction is true", async () => {
    mockLookup.mockResolvedValue({
      ...NO_MATCH, matchCount: 1, hasSanction: true, sourceSlug: "ofac",
    });
    const r = await runIntelligenceOverlay(SAMPLE_INPUT);
    expect(r.signals).toHaveLength(1);
    expect(r.signals[0].severity).toBe("CRITICAL");
    expect(r.signals[0].stopTrigger).toBe(true);
    expect(r.signals[0].code).toBe("intelligenceOverlay.sanction");
  });

  it("emits STRONG + stopTrigger=false on non-sanction match", async () => {
    mockLookup.mockResolvedValue({
      ...NO_MATCH, matchCount: 1, hasSanction: false, sourceSlug: "goplus",
    });
    const r = await runIntelligenceOverlay(SAMPLE_INPUT);
    expect(r.signals[0].severity).toBe("STRONG");
    expect(r.signals[0].stopTrigger).toBe(false);
    expect(r.signals[0].code).toBe("intelligenceOverlay.match");
  });

  it("maps reflex chain 'evm' to 'ethereum' for the intelligence lookup", async () => {
    mockLookup.mockResolvedValue(NO_MATCH);
    await runIntelligenceOverlay(SAMPLE_INPUT);
    expect(mockLookup).toHaveBeenCalledWith("0xabc", "ethereum");
  });

  it("returns ran:false + error on lookup failure", async () => {
    mockLookup.mockRejectedValue(new Error("intel down"));
    const r = await runIntelligenceOverlay(SAMPLE_INPUT);
    expect(r.ran).toBe(false);
    expect(r.error).toBe("intel down");
  });
});
