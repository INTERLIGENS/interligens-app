import { describe, it, expect } from "vitest";

function buildWhaleVal(top1: number|null, top3: number|null, top10: number|null, lang: "en"|"fr") {
  const parts: string[] = [];
  if (top1  != null) parts.push("Top1 "  + Math.round(top1)  + "%");
  if (top3  != null) parts.push("Top3 "  + Math.round(top3)  + "%");
  if (top10 != null) parts.push("Top10 " + Math.round(top10) + "%");
  return parts.length > 0 ? parts.join(" · ") : (lang === "fr" ? "Holders indisponible (démo)" : "Holders unavailable (demo)");
}

describe("MiniSignalRow whaleVal", () => {
  it("null => unavailable (demo)", () => {
    expect(buildWhaleVal(null, null, null, "en")).toContain("unavailable (demo)");
    expect(buildWhaleVal(null, null, null, "fr")).toContain("indisponible");
  });

  it("top1/top3/top10 => contains all three", () => {
    const v = buildWhaleVal(18, 41, 62, "en");
    expect(v).toContain("Top1");
    expect(v).toContain("Top3");
    expect(v).toContain("Top10");
    expect(v).toContain("18%");
    expect(v).toContain("41%");
    expect(v).toContain("62%");
  });

  it("only top10 => just Top10", () => {
    const v = buildWhaleVal(null, null, 55, "en");
    expect(v).toBe("Top10 55%");
  });
});
