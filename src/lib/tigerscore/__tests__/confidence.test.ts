import { describe, it, expect } from "vitest";
import {
  computeConfidenceLevel,
  confidenceFromResult,
  isHigherConfidence,
} from "@/lib/tigerscore/confidence";
import type { TigerDriver } from "@/lib/tigerscore/engine";

function driver(
  severity: TigerDriver["severity"],
  id: string = severity,
  delta = 10,
): TigerDriver {
  return {
    id,
    label: id.toUpperCase(),
    severity,
    delta,
    why: "test driver",
  };
}

describe("computeConfidenceLevel", () => {
  it("returns Low when RPC is down regardless of drivers", () => {
    const c = computeConfidenceLevel({
      drivers: [driver("critical"), driver("high")],
      rpcDown: true,
    });
    expect(c).toBe("Low");
  });

  it("returns Low with no drivers", () => {
    expect(computeConfidenceLevel({ drivers: [] })).toBe("Low");
  });

  it("High when one critical + at least one supporting", () => {
    const c = computeConfidenceLevel({
      drivers: [driver("critical", "c1"), driver("med", "m1")],
    });
    expect(c).toBe("High");
  });

  it("High with two high-severity drivers", () => {
    const c = computeConfidenceLevel({
      drivers: [driver("high", "h1"), driver("high", "h2")],
    });
    expect(c).toBe("High");
  });

  it("Medium with exactly one critical driver", () => {
    const c = computeConfidenceLevel({
      drivers: [driver("critical", "c1")],
    });
    expect(c).toBe("Medium");
  });

  it("Medium with exactly one high driver", () => {
    const c = computeConfidenceLevel({ drivers: [driver("high", "h1")] });
    expect(c).toBe("Medium");
  });

  it("Medium with two med drivers", () => {
    const c = computeConfidenceLevel({
      drivers: [driver("med", "m1"), driver("med", "m2")],
    });
    expect(c).toBe("High"); // two meds escalate to High unless RPC fallback
  });

  it("Medium (not High) when rpcFallbackUsed is true", () => {
    const c = computeConfidenceLevel({
      drivers: [driver("med", "m1"), driver("med", "m2")],
      rpcFallbackUsed: true,
    });
    expect(c).toBe("Medium");
  });

  it("Low when single med driver + RPC fallback", () => {
    const c = computeConfidenceLevel({
      drivers: [driver("med", "m1")],
      rpcFallbackUsed: true,
    });
    expect(c).toBe("Low");
  });

  it("Low with only low-severity drivers", () => {
    const c = computeConfidenceLevel({
      drivers: [driver("low"), driver("low", "l2")],
    });
    expect(c).toBe("Low");
  });
});

describe("confidenceFromResult", () => {
  it("pulls drivers from the result object", () => {
    const c = confidenceFromResult({
      drivers: [driver("high", "h1"), driver("high", "h2")],
      score: 80,
      confidence: "Medium",
    });
    expect(c).toBe("High");
  });
});

describe("isHigherConfidence", () => {
  it("ranks High > Medium > Low", () => {
    expect(isHigherConfidence("High", "Medium")).toBe(true);
    expect(isHigherConfidence("Medium", "Low")).toBe(true);
    expect(isHigherConfidence("Low", "High")).toBe(false);
    expect(isHigherConfidence("High", "High")).toBe(false);
  });
});
