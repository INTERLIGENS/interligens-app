import { describe, it, expect } from "vitest";
import { buildDemoUrl } from "./urls";
import { DEMO_PRESETS } from "./presets";

describe("buildDemoUrl", () => {
  it("includes mock param", () => {
    const url = buildDemoUrl({ locale: "en", mock: "red" });
    expect(url).toBe("/en/demo?mock=red");
  });

  it("encodes address with encodeURIComponent", () => {
    const url = buildDemoUrl({ locale: "fr", mock: "green", address: "abc def+xyz" });
    expect(url).toContain("address=abc+def%2Bxyz");
  });

  it("no params => clean url", () => {
    const url = buildDemoUrl({ locale: "en" });
    expect(url).toBe("/en/demo");
  });

  it("chain param included", () => {
    const url = buildDemoUrl({ locale: "en", chain: "ETH", mock: "orange" });
    expect(url).toContain("chain=ETH");
    expect(url).toContain("mock=orange");
  });
});

describe("DEMO_PRESETS storylines", () => {
  const chains = ["SOL", "ETH"] as const;
  const scenarios = ["green", "orange", "red"] as const;

  for (const chain of chains) {
    for (const scenario of scenarios) {
      it(`${chain}/${scenario} has non-empty EN + FR storyline`, () => {
        const preset = DEMO_PRESETS[chain][scenario];
        expect(preset.storyline.en.length).toBeGreaterThan(10);
        expect(preset.storyline.fr.length).toBeGreaterThan(10);
      });
    }
  }
});
