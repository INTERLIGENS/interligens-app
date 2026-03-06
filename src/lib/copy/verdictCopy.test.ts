import { describe, it, expect } from "vitest";
import { getVerdictCopy } from "./verdictCopy";

describe("getVerdictCopy", () => {
  it("GREEN FR — subtitle sans alerte + actions safe", () => {
    const c = getVerdictCopy("GREEN", "fr");
    expect(c.subtitle).toContain("Pas d'alerte critique");
    expect(c.actions[0]).toContain("URL");
    expect(c.actions[0]).not.toContain("STOP");
    expect(c.disclaimer).toContain("DYOR");
  });

  it("ORANGE EN — subtitle suspicious + actions cautious", () => {
    const c = getVerdictCopy("ORANGE", "en");
    expect(c.subtitle).toContain("Suspicious");
    expect(c.actions[0]).toContain("signing");
    expect(c.actions[0]).not.toContain("STOP");
    expect(c.disclaimer).toContain("DYOR");
  });

  it("RED FR — subtitle haut risque + STOP en action 1", () => {
    const c = getVerdictCopy("RED", "fr");
    expect(c.subtitle).toContain("haut risque");
    expect(c.subtitle).not.toContain("wallet sain");
    expect(c.subtitle).not.toContain("looks clean");
    expect(c.actions[0]).toContain("STOP");
    expect(c.disclaimer).toContain("DYOR");
  });

  it("RED EN — subtitle correct + STOP", () => {
    const c = getVerdictCopy("RED", "en");
    expect(c.subtitle).toContain("High-risk");
    expect(c.subtitle).not.toContain("looks clean");
    expect(c.actions[0]).toContain("STOP");
  });

  it("GREEN EN — label SAFE", () => {
    expect(getVerdictCopy("GREEN", "en").label).toBe("SAFE");
  });

  it("RED FR — label ÉVITER", () => {
    expect(getVerdictCopy("RED", "fr").label).toBe("ÉVITER");
  });
});
