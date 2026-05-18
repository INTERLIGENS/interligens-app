import { describe, it, expect } from "vitest";
import {
  ALLOWED_WORKFLOW_TRANSITIONS,
  MM_STATUS_DEFAULT_SCORE_RANGE,
  MM_STATUS_TO_RISK_BAND,
  isAllowedTransition,
} from "@/lib/mm/types";

describe("MmWorkflow transitions", () => {
  it("DRAFT allows REVIEWED or UNPUBLISHED", () => {
    expect(ALLOWED_WORKFLOW_TRANSITIONS.DRAFT).toEqual(["REVIEWED", "UNPUBLISHED"]);
  });

  it("PUBLISHED can go to CHALLENGED or UNPUBLISHED but not back to DRAFT directly", () => {
    expect(ALLOWED_WORKFLOW_TRANSITIONS.PUBLISHED).toEqual([
      "CHALLENGED",
      "UNPUBLISHED",
    ]);
    expect(isAllowedTransition("PUBLISHED", "DRAFT")).toBe(false);
  });

  it("rejects no-op transitions", () => {
    expect(isAllowedTransition("DRAFT", "DRAFT")).toBe(false);
    expect(isAllowedTransition("PUBLISHED", "PUBLISHED")).toBe(false);
  });

  it("allows CHALLENGED → PUBLISHED", () => {
    expect(isAllowedTransition("CHALLENGED", "PUBLISHED")).toBe(true);
  });

  it("UNPUBLISHED can only come back to DRAFT", () => {
    expect(ALLOWED_WORKFLOW_TRANSITIONS.UNPUBLISHED).toEqual(["DRAFT"]);
    expect(isAllowedTransition("UNPUBLISHED", "PUBLISHED")).toBe(false);
  });
});

describe("MmStatus → RiskBand mapping", () => {
  it("CONVICTED and CHARGED map to RED", () => {
    expect(MM_STATUS_TO_RISK_BAND.CONVICTED).toBe("RED");
    expect(MM_STATUS_TO_RISK_BAND.CHARGED).toBe("RED");
  });

  it("OBSERVED stays YELLOW", () => {
    expect(MM_STATUS_TO_RISK_BAND.OBSERVED).toBe("YELLOW");
  });
});

describe("MmStatus default score range", () => {
  it("CONVICTED spans 90-100 with 0.9 min confidence", () => {
    expect(MM_STATUS_DEFAULT_SCORE_RANGE.CONVICTED).toEqual({
      min: 90,
      max: 100,
      minConfidence: 0.9,
    });
  });

  it("OBSERVED contributes no floor", () => {
    expect(MM_STATUS_DEFAULT_SCORE_RANGE.OBSERVED.max).toBe(0);
  });
});
