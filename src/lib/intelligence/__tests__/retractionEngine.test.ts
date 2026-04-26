import { describe, it, expect } from "vitest";
import {
  validateRetractionInput,
  type RetractionInput,
  type EntityType,
  type RetractionSeverity,
} from "../retractionEngine";

function mkInput(overrides: Partial<RetractionInput> = {}): Partial<RetractionInput> {
  return {
    entityType: "kol_profile",
    entityId: "bkokoski",
    kolHandle: "bkokoski",
    reason: "Score was inflated due to stale data",
    previousValue: "85",
    correctedValue: "42",
    severity: "major",
    initiatedBy: "admin",
    ...overrides,
  };
}

describe("validateRetractionInput", () => {
  it("valid input passes", () => {
    const { valid, errors } = validateRetractionInput(mkInput());
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it("missing entityType → error", () => {
    const { valid, errors } = validateRetractionInput(mkInput({ entityType: undefined }));
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("entityType"))).toBe(true);
  });

  it("invalid entityType → error", () => {
    const { valid, errors } = validateRetractionInput(mkInput({ entityType: "unknown_type" as EntityType }));
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("entityType"))).toBe(true);
  });

  it("missing entityId → error", () => {
    const { valid, errors } = validateRetractionInput(mkInput({ entityId: "" }));
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("entityId"))).toBe(true);
  });

  it("reason too short → error", () => {
    const { valid, errors } = validateRetractionInput(mkInput({ reason: "bad" }));
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("reason"))).toBe(true);
  });

  it("invalid severity → error", () => {
    const { valid, errors } = validateRetractionInput(mkInput({ severity: "extreme" as RetractionSeverity }));
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("severity"))).toBe(true);
  });

  it("all entity types are valid", () => {
    const types: EntityType[] = ["kol_profile", "casefile", "score", "proceeds"];
    for (const entityType of types) {
      const { valid } = validateRetractionInput(mkInput({ entityType }));
      expect(valid).toBe(true);
    }
  });

  it("null kolHandle is allowed (system-level retraction)", () => {
    const { valid } = validateRetractionInput(mkInput({ kolHandle: null }));
    expect(valid).toBe(true);
  });

  it("null previousValue and correctedValue are allowed", () => {
    const { valid } = validateRetractionInput(
      mkInput({ previousValue: null, correctedValue: null }),
    );
    expect(valid).toBe(true);
  });
});
