import { describe, it, expect } from "vitest";
import { getTier, computeFinalVerdict } from "./tier";

describe("getTier", () => {
  it("0 → GREEN",  () => expect(getTier(0)).toBe("GREEN"));
  it("34 → GREEN", () => expect(getTier(34)).toBe("GREEN"));
  it("35 → ORANGE",() => expect(getTier(35)).toBe("ORANGE"));
  it("69 → ORANGE",() => expect(getTier(69)).toBe("ORANGE"));
  it("70 → RED",   () => expect(getTier(70)).toBe("RED"));
  it("100 → RED",  () => expect(getTier(100)).toBe("RED"));
  it("20 → GREEN (BONK demo score)", () => expect(getTier(20)).toBe("GREEN"));
});

describe("computeFinalVerdict", () => {
  it("pas de récidive → base inchangé", () => {
    const v = computeFinalVerdict(20, "GREEN", false, "LOW");
    expect(v.tier).toBe("GREEN");
    expect(v.score).toBe(20);
    expect(v.label.en).toBe("Proceed");
    expect(v.label.fr).toBe("OK");
  });

  it("récidive HIGH → RED + score >= 85", () => {
    const v = computeFinalVerdict(20, "GREEN", true, "HIGH");
    expect(v.tier).toBe("RED");
    expect(v.score).toBeGreaterThanOrEqual(85);
    expect(v.label.en).toBe("Avoid");
    expect(v.label.fr).toBe("Éviter");
  });

  it("récidive MED + GREEN → ORANGE + score >= 70", () => {
    const v = computeFinalVerdict(20, "GREEN", true, "MED");
    expect(v.tier).toBe("ORANGE");
    expect(v.score).toBeGreaterThanOrEqual(70);
    expect(v.label.en).toBe("Caution");
    expect(v.label.fr).toBe("Attention");
  });

  it("récidive MED + RED → RED conservé", () => {
    const v = computeFinalVerdict(80, "RED", true, "MED");
    expect(v.tier).toBe("RED");
  });

  it("récidive HIGH + score déjà 90 → score conservé", () => {
    const v = computeFinalVerdict(90, "RED", true, "HIGH");
    expect(v.score).toBe(90);
  });

  it("GREEN jamais affiché si récidive HIGH", () => {
    const v = computeFinalVerdict(10, "GREEN", true, "HIGH");
    expect(v.tier).not.toBe("GREEN");
    expect(v.label.en).not.toBe("Proceed");
    expect(v.label.fr).not.toBe("OK");
  });

  it("sub EN correct pour RED", () => {
    const v = computeFinalVerdict(20, "GREEN", true, "HIGH");
    expect(v.sub.en).toContain("Avoid");
  });

  it("sub FR correct pour ORANGE", () => {
    const v = computeFinalVerdict(20, "GREEN", true, "MED");
    expect(v.sub.fr).toContain("prudence");
  });
});
