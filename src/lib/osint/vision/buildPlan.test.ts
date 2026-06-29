import { describe, it, expect } from "vitest";
import { buildPlan } from "./buildPlan";
import type { VisionOutput, VisionToken } from "./visionPrompt";

const SOL_CA = "FWgBzdGaGZxnS9KGV8q2525kfyrqPyc8mA2Z2ZZqpump";

function tok(p: Partial<VisionToken>): VisionToken {
  return {
    tokenSymbol: "TOES",
    tokenSymbolConfidence: "high",
    contractAddress: null,
    contractAddressConfidence: "low",
    contractAddressCertain: false,
    chain: "solana",
    chainConfidence: "high",
    perf: null,
    ...p,
  };
}
function vision(p: Partial<VisionOutput>): VisionOutput {
  return {
    kolHandle: "captain_meme1",
    kolHandleConfidence: "high",
    snapshotType: "osint_x_search",
    tokens: [],
    readWithCertainty: [],
    uncertain: [],
    notes: null,
    ...p,
  };
}
const base = { sha256: "a".repeat(64), bytes: 1234, fileName: "shot.png" };

describe("buildPlan — seed-format & anti-invention guards", () => {
  it("(a) certain + well-formed CA passes through as a resolved link", () => {
    const plan = buildPlan({
      vision: vision({ tokens: [tok({ contractAddress: SOL_CA, contractAddressCertain: true, contractAddressConfidence: "high" })] }),
      ...base,
    });
    const link = plan.kolTokenLinksToCreate[0];
    expect(link.contractAddress).toBe(SOL_CA);
    expect(link.chain).toBe("solana");
    expect(plan.counts.nb_links_real_ca).toBe(1);
    expect(plan.counts.nb_links_pending).toBe(0);
  });

  it("(b) a doubtful CA (certain=false) is forced to PENDING", () => {
    const plan = buildPlan({
      vision: vision({ tokens: [tok({ tokenSymbol: "TROLL", contractAddress: SOL_CA, contractAddressCertain: false })] }),
      ...base,
    });
    expect(plan.kolTokenLinksToCreate[0].contractAddress).toBe("PENDING:TROLL");
    expect(plan.counts.nb_links_pending).toBe(1);
    expect(plan.uncertain).toContain("contractAddress(TROLL)");
  });

  it("(c) an illegible ticker becomes tokenSymbol=null + warning", () => {
    const plan = buildPlan({ vision: vision({ tokens: [tok({ tokenSymbol: null })] }), ...base });
    expect(plan.kolTokenLinksToCreate[0].tokenSymbol).toBeNull();
    expect(plan.warnings.some((w) => w.startsWith("TICKER_NULL"))).toBe(true);
  });

  it("(d) ambiguous chain stays 'unknown' + warning, no mint merge", () => {
    const plan = buildPlan({
      vision: vision({ tokens: [tok({ tokenSymbol: "AMBI", chain: "unknown", contractAddress: null })] }),
      ...base,
    });
    expect(plan.kolTokenLinksToCreate[0].chain).toBe("unknown");
    expect(plan.warnings.some((w) => w.startsWith("CHAIN_UNKNOWN"))).toBe(true);
  });

  it("(e) a malformed CA the model marked certain is REJECTED by code -> PENDING", () => {
    const plan = buildPlan({
      vision: vision({ tokens: [tok({ tokenSymbol: "FAKE", contractAddress: "FWgBz_not_valid!!", contractAddressCertain: true, contractAddressConfidence: "high" })] }),
      ...base,
    });
    expect(plan.kolTokenLinksToCreate[0].contractAddress).toBe("PENDING:FAKE");
    expect(plan.warnings.some((w) => w.startsWith("CA_REJECTED"))).toBe(true);
  });

  it("chain is derived from a valid CA format when model said 'unknown'", () => {
    const plan = buildPlan({
      vision: vision({ tokens: [tok({ tokenSymbol: "EVMTOK", contractAddress: "0x" + "b".repeat(40), contractAddressCertain: true, chain: "unknown" })] }),
      ...base,
    });
    expect(plan.kolTokenLinksToCreate[0].chain).toBe("ethereum");
  });

  it("multi-ticker: ONE evidence (sha256), N links, distinct cashtags only", () => {
    const plan = buildPlan({
      vision: vision({
        tokens: [
          tok({ tokenSymbol: "AAA" }),
          tok({ tokenSymbol: "BBB" }),
          tok({ tokenSymbol: "AAA" }), // dup -> dropped
        ],
      }),
      ...base,
    });
    expect(plan.evidences).toHaveLength(1);
    expect(plan.evidences[0].sha256).toBe(base.sha256);
    expect(plan.kolTokenLinksToCreate).toHaveLength(2);
  });

  it("ALWAYS shadow: profile publishable=false / draft, evidence not public", () => {
    const plan = buildPlan({ vision: vision({ tokens: [tok({})] }), ...base });
    expect(plan.kolProfileToCreate.publishable).toBe(false);
    expect(plan.kolProfileToCreate.publishStatus).toBe("draft");
    expect(plan.evidences[0].isPublic).toBe(false);
    expect(plan.extractionMethod).toBe("vision_auto");
  });

  it("handle: image value wins; missing image+hint -> placeholder + warning", () => {
    const withHint = buildPlan({ vision: vision({ kolHandle: null }), kolHandleHint: "hintguy", ...base });
    expect(withHint.kolHandle).toBe("hintguy");
    expect(withHint.warnings.some((w) => w.startsWith("HANDLE_FROM_HINT"))).toBe(true);

    const none = buildPlan({ vision: vision({ kolHandle: null }), ...base });
    expect(none.kolHandle).toBe("unknown_handle");
    expect(none.warnings.some((w) => w.startsWith("HANDLE_UNREADABLE"))).toBe(true);
  });

  it("capturedAt null -> null + warning, never invented", () => {
    const plan = buildPlan({ vision: vision({ tokens: [tok({})] }), ...base });
    expect(plan.evidences[0].capturedAt).toBeNull();
    expect(plan.capturedDate).toBeNull();
    expect(plan.warnings.some((w) => w.startsWith("CAPTURED_AT_NULL"))).toBe(true);
  });
});
