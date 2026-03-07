import { describe, it, expect } from "vitest";
import { evaluateQuarantine } from "../quarantine";

describe("quarantine rules", () => {
  it("mixed chains => quarantine", () => {
    const r = evaluateQuarantine({
      inputType: "csv", chains: ["solana","ethereum"],
      totalRows: 10, invalidRows: 0, labelTypes: ["scam"], hasEvidence: true,
    });
    expect(r.quarantine).toBe(true);
    expect(r.reasons).toContain("mixed_chains");
  });

  it("invalid ratio > 5% => quarantine", () => {
    const r = evaluateQuarantine({
      inputType: "csv", chains: ["solana"],
      totalRows: 100, invalidRows: 10, labelTypes: ["airdrop_target"], hasEvidence: true,
    });
    expect(r.quarantine).toBe(true);
    expect(r.reasons).toContain("invalid_ratio");
  });

  it("paused source => quarantine", () => {
    const r = evaluateQuarantine({
      inputType: "csv", chains: ["solana"], sourceStatus: "paused",
      totalRows: 10, invalidRows: 0, labelTypes: ["kol"], hasEvidence: true,
    });
    expect(r.quarantine).toBe(true);
    expect(r.reasons).toContain("source_paused");
  });

  it("license missing + external => quarantine", () => {
    const r = evaluateQuarantine({
      inputType: "url", chains: ["ethereum"], license: null,
      totalRows: 10, invalidRows: 0, labelTypes: ["other"], hasEvidence: true,
    });
    expect(r.quarantine).toBe(true);
    expect(r.reasons).toContain("license_missing");
  });

  it("high-risk label + community + no evidence => quarantine", () => {
    const r = evaluateQuarantine({
      inputType: "csv", chains: ["solana"], sourceType: "community",
      totalRows: 10, invalidRows: 0, labelTypes: ["scam"], hasEvidence: false,
    });
    expect(r.quarantine).toBe(true);
    expect(r.reasons).toContain("weak_evidence");
  });

  it("clean batch => no quarantine", () => {
    const r = evaluateQuarantine({
      inputType: "csv", chains: ["solana"], license: "CC0",
      sourceStatus: "active", sourceType: "threat_intel",
      totalRows: 10, invalidRows: 0, labelTypes: ["scam"], hasEvidence: true,
    });
    expect(r.quarantine).toBe(false);
    expect(r.reasons).toHaveLength(0);
  });
});
