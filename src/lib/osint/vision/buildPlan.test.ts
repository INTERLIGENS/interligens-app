import { describe, it, expect } from "vitest";
import { buildPlan } from "./buildPlan";
import type { VisionOutput } from "./visionPrompt";
import type { TokenResolution } from "./resolveTokens";

const SOL_CA = "6ehEcTMCc85aNF4x9CWx8HuvWGhxQtvKdhKVf2HDpump";

function vision(p: Partial<VisionOutput>): VisionOutput {
  return {
    kolHandle: "gordongekko", kolHandleConfidence: "high", snapshotType: "osint_x_search",
    tokens: [], readWithCertainty: [], uncertain: [], notes: null,
    diagnostics: { passes: 2, secondPassError: null, handleReads: ["gordongekko", "gordongekko"], tokenCountReads: [1, 1], tokens: [] },
    ...p,
  };
}
function resolved(sym: string): TokenResolution {
  return {
    tokenSymbol: sym, contractAddress: SOL_CA, chain: "solana", zone: "primary", resolved: true,
    resolutionPath: "double_vision:ok|onchain:ok|ticker:ok", warnings: [],
    audit: { caReads: [SOL_CA, SOL_CA], caCertainHint: true, onChainSymbol: sym, onChainStatus: "exists" },
  };
}
function pending(sym: string, path: string, warn: string): TokenResolution {
  return {
    tokenSymbol: sym, contractAddress: `PENDING:${sym}`, chain: "solana", zone: "primary", resolved: false,
    resolutionPath: path, warnings: [warn],
    audit: { caReads: ["x", "y"], caCertainHint: true, onChainSymbol: null, onChainStatus: null },
  };
}
const base = { sha256: "a".repeat(64), bytes: 1234, fileName: "shot.png" };

describe("buildPlan — assembly from three-lock resolutions", () => {
  it("a resolved token becomes a real-CA link, counts + resolutionPath surfaced", () => {
    const plan = buildPlan({ vision: vision({}), resolutions: [resolved("TOES")], ...base });
    const link = plan.kolTokenLinksToCreate[0];
    expect(link.contractAddress).toBe(SOL_CA);
    expect(link.resolutionPath).toBe("double_vision:ok|onchain:ok|ticker:ok");
    expect(plan.counts.nb_links_real_ca).toBe(1);
    expect(plan.counts.nb_links_pending).toBe(0);
    expect(plan.confidence.perTokenSummary[0].ca).toBe("resolved");
  });

  it("a pending token becomes PENDING:<TICKER>, warning + uncertain propagated", () => {
    const plan = buildPlan({ vision: vision({}), resolutions: [pending("TOES", "onchain:not_found", "CA_NOT_ONCHAIN: fake")], ...base });
    expect(plan.kolTokenLinksToCreate[0].contractAddress).toBe("PENDING:TOES");
    expect(plan.counts.nb_links_pending).toBe(1);
    expect(plan.warnings.some((w) => w.startsWith("CA_NOT_ONCHAIN"))).toBe(true);
    expect(plan.uncertain).toContain("contractAddress(TOES)");
  });

  it("multi-ticker: N links, exactly ONE evidence keyed on sha256", () => {
    const plan = buildPlan({ vision: vision({}), resolutions: [resolved("AAA"), pending("BBB", "onchain:not_found", "CA_NOT_ONCHAIN")], ...base });
    expect(plan.kolTokenLinksToCreate).toHaveLength(2);
    expect(plan.evidences).toHaveLength(1);
    expect(plan.evidences[0].sha256).toBe(base.sha256);
  });

  it("ALWAYS shadow: publishable=false/draft, evidence not public, vision_auto", () => {
    const plan = buildPlan({ vision: vision({}), resolutions: [resolved("TOES")], ...base });
    expect(plan.kolProfileToCreate.publishable).toBe(false);
    expect(plan.kolProfileToCreate.publishStatus).toBe("draft");
    expect(plan.evidences[0].isPublic).toBe(false);
    expect(plan.extractionMethod).toBe("vision_auto");
  });

  it("handle: image wins; missing image+hint -> placeholder + warning", () => {
    const withHint = buildPlan({ vision: vision({ kolHandle: null }), resolutions: [], kolHandleHint: "hintguy", ...base });
    expect(withHint.kolHandle).toBe("hintguy");
    expect(withHint.warnings.some((w) => w.startsWith("HANDLE_FROM_HINT"))).toBe(true);
    const none = buildPlan({ vision: vision({ kolHandle: null }), resolutions: [], ...base });
    expect(none.kolHandle).toBe("unknown_handle");
    expect(none.warnings.some((w) => w.startsWith("HANDLE_UNREADABLE"))).toBe(true);
  });

  it("capturedAt null -> null + warning, never invented", () => {
    const plan = buildPlan({ vision: vision({}), resolutions: [resolved("TOES")], ...base });
    expect(plan.evidences[0].capturedAt).toBeNull();
    expect(plan.capturedDate).toBeNull();
    expect(plan.warnings.some((w) => w.startsWith("CAPTURED_AT_NULL"))).toBe(true);
  });
});
