import { describe, it, expect } from "vitest";
import { assertTransition, isTerminal, WorkflowError } from "@/lib/mm/registry/workflow";

describe("assertTransition", () => {
  it("accepts DRAFT → REVIEWED", () => {
    expect(() => assertTransition("DRAFT", "REVIEWED")).not.toThrow();
  });

  it("rejects DRAFT → PUBLISHED (must go through REVIEWED first)", () => {
    expect(() => assertTransition("DRAFT", "PUBLISHED")).toThrow(WorkflowError);
  });

  it("rejects REVIEWED → CHALLENGED", () => {
    expect(() => assertTransition("REVIEWED", "CHALLENGED")).toThrow(
      /illegal transition/,
    );
  });

  it("accepts CHALLENGED → PUBLISHED and CHALLENGED → UNPUBLISHED", () => {
    expect(() => assertTransition("CHALLENGED", "PUBLISHED")).not.toThrow();
    expect(() => assertTransition("CHALLENGED", "UNPUBLISHED")).not.toThrow();
  });

  it("rejects self-transition", () => {
    expect(() => assertTransition("PUBLISHED", "PUBLISHED")).toThrow(/no-op transition/);
  });

  it("rejects UNPUBLISHED → PUBLISHED (must go back through DRAFT)", () => {
    expect(() => assertTransition("UNPUBLISHED", "PUBLISHED")).toThrow();
  });
});

describe("isTerminal", () => {
  it("UNPUBLISHED is considered terminal-like", () => {
    expect(isTerminal("UNPUBLISHED")).toBe(true);
  });

  it("DRAFT, REVIEWED, PUBLISHED, CHALLENGED are not terminal", () => {
    for (const s of ["DRAFT", "REVIEWED", "PUBLISHED", "CHALLENGED"] as const) {
      expect(isTerminal(s)).toBe(false);
    }
  });
});

describe("WorkflowError shape", () => {
  it("carries a code field for error handling", () => {
    try {
      assertTransition("DRAFT", "CHALLENGED");
    } catch (err) {
      expect(err).toBeInstanceOf(WorkflowError);
      expect((err as WorkflowError).code).toBe("INVALID_TRANSITION");
    }
  });
});
