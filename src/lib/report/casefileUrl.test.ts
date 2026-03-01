import { describe, it, expect } from "vitest";
import { buildCaseFileUrl, buildCaseFileFilename } from "./casefileUrl";

describe("buildCaseFileUrl", () => {
  it("encodes special chars in id", () => {
    const url = buildCaseFileUrl({ id: "abc def+xyz", lang: "en" });
    expect(url).toContain("abc%20def%2Bxyz");
    expect(url).toContain("lang=en");
  });

  it("lang=fr correct", () => {
    const url = buildCaseFileUrl({ id: "TESTMINT", lang: "fr" });
    expect(url).toContain("lang=fr");
    expect(url).toContain("mint=TESTMINT");
  });

  it("contains timestamp anti-cache", () => {
    const url = buildCaseFileUrl({ id: "X", lang: "en" });
    expect(url).toContain("t=");
  });

  it("buildCaseFileFilename slices to 8 chars", () => {
    const f = buildCaseFileFilename("BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4v");
    expect(f).toBe("casefile-BYZ9CcZG.pdf");
  });
});
