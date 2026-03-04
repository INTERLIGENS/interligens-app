import { describe, it, expect } from "vitest";
import { buildWhatYouSign } from "./txPreview";

describe("buildWhatYouSign", () => {
  it("null if no scan", () => {
    expect(buildWhatYouSign(null)).toBeNull();
  });

  it("unlimited approvals detected", () => {
    const r = buildWhatYouSign({ on_chain: { unlimitedCount: 2, spenders: [] } });
    expect(r).not.toBeNull();
    expect(r!.lines_en[0]).toContain("unlimited");
  });

  it("official spender recognized", () => {
    const r = buildWhatYouSign({ on_chain: { unlimitedCount: 0, spenders: [{ badge: "OFFICIAL", label: "Uniswap V3" }] } });
    expect(r!.lines_en[0]).toContain("Official router");
  });

  it("unknown spenders >=2", () => {
    const r = buildWhatYouSign({ on_chain: { unlimitedCount: 0, spenders: [{ badge: "UNKNOWN" }, { badge: "UNKNOWN" }] } });
    expect(r!.lines_en[0]).toContain("unknown");
  });
});
