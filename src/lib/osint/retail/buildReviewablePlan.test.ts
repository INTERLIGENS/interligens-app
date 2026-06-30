/**
 * Tests du pont vision → ReviewablePlan. INVARIANTS retail : trustTier toujours
 * anonymous_retail ; un CA non résolu n'écrit jamais de CA (null) ; un CA lu mais
 * non résolu est marqué pending (CA_PARTIAL côté humain), pas absent.
 */
import { describe, it, expect } from "vitest";
import { buildReviewablePlan } from "./buildReviewablePlan";
import { SourceTrustTier } from "../contracts";
import type { VisionOutput } from "../vision/visionPrompt";
import type { TokenResolution } from "../vision/resolveTokens";

const vision: VisionOutput = {
  kolHandle: "someKol",
  kolHandleConfidence: "high",
  snapshotType: "osint_x_search",
  tokens: [
    { tokenSymbol: "ABC", tokenSymbolConfidence: "high", contractAddress: null, contractAddressConfidence: "low", contractAddressCertain: false, chain: "solana", chainConfidence: "high", perf: "12x" },
  ],
  readWithCertainty: [],
  uncertain: [],
  notes: null,
};

const baseInput = {
  vision,
  imageSha256: "a".repeat(64),
  perceptualHash: null,
  modelVersion: "claude-sonnet-4-5",
  promptVersion: "vision_v1",
  submitter: "iphash_deadbeef",
  ingestedAt: "2026-06-30T00:00:00.000Z",
  sourceType: "osint_retail_screenshot",
  capturedAt: null,
  fileName: "retail_test",
  bytes: 0,
  tweetUrl: null,
  contextNote: null,
};

function resolution(over: Partial<TokenResolution>): TokenResolution {
  return {
    tokenSymbol: "ABC",
    contractAddress: "PENDING:ABC",
    chain: "solana",
    resolved: false,
    resolutionPath: "double_vision:disagree",
    warnings: [],
    audit: { caReads: [null, null], caCertainHint: false, onChainSymbol: null, onChainStatus: null },
    ...over,
  };
}

describe("buildReviewablePlan", () => {
  it("always sets trustTier anonymous_retail", () => {
    const plan = buildReviewablePlan({ ...baseInput, resolutions: [resolution({})] });
    expect(plan.provenance.trustTier).toBe(SourceTrustTier.ANONYMOUS_RETAIL);
  });

  it("unresolved CA → claim contractAddress is null (never writes a CA)", () => {
    const plan = buildReviewablePlan({ ...baseInput, resolutions: [resolution({ resolved: false })] });
    expect(plan.claims[0].contractAddress).toBeNull();
  });

  it("CA read but unresolved → marked pending (not absent)", () => {
    const plan = buildReviewablePlan({
      ...baseInput,
      resolutions: [resolution({ resolved: false, audit: { caReads: ["So111", null], caCertainHint: true, onChainSymbol: null, onChainStatus: "not_found" } })],
    });
    expect(plan.claims[0].signals?.caState).toBe("pending");
  });

  it("resolved CA → claim carries the real CA", () => {
    const ca = "So11111111111111111111111111111111111111112";
    const plan = buildReviewablePlan({
      ...baseInput,
      resolutions: [resolution({ resolved: true, contractAddress: ca })],
    });
    expect(plan.claims[0].contractAddress).toBe(ca);
  });

  it("carries tweetUrl/context into provenance audit trail", () => {
    const plan = buildReviewablePlan({ ...baseInput, resolutions: [resolution({})], tweetUrl: "https://x.com/x/1", contextNote: "a call" });
    expect(plan.provenance.decisionReasons.some((r) => r.includes("x.com"))).toBe(true);
  });
});
