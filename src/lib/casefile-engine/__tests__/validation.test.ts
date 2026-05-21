import { describe, test, expect } from "vitest";
import { enforceSandboxRules } from "../validation";

describe("Casefile sandbox validation — V1", () => {
  test("rejects classification other than synthetic-demo", () => {
    const r = enforceSandboxRules({ dataClassification: "production-internal" });
    expect(r.ok).toBe(false);
    expect(r.corrections[0]).toMatch(/not allowed in V1/);
  });

  test("rejects 'sandbox' classification", () => {
    const r = enforceSandboxRules({ dataClassification: "sandbox" });
    expect(r.ok).toBe(false);
  });

  test("accepts synthetic-demo with empty exhibits", () => {
    const r = enforceSandboxRules({
      dataClassification: "synthetic-demo",
      exhibits: [],
    });
    expect(r.ok).toBe(true);
    expect(r.corrections).toEqual([]);
  });

  test("auto-converts contains-pii to synthetic-pii-placeholder", () => {
    const draft = {
      dataClassification: "synthetic-demo",
      exhibits: [
        { exhibitId: "EX-1", redactionStatus: "contains-pii" },
        { exhibitId: "EX-2", redactionStatus: "redacted" },
      ],
    };
    const r = enforceSandboxRules(draft);
    expect(r.ok).toBe(true);
    expect(draft.exhibits[0]?.redactionStatus).toBe(
      "synthetic-pii-placeholder",
    );
    expect(draft.exhibits[1]?.redactionStatus).toBe("redacted");
    expect(r.corrections).toHaveLength(1);
    expect(r.corrections[0]).toContain("EX-1");
  });

  test("missing dataClassification accepted (defaults assumed at DB)", () => {
    const r = enforceSandboxRules({});
    expect(r.ok).toBe(true);
  });

  test("reports every contains-pii exhibit", () => {
    const draft = {
      dataClassification: "synthetic-demo",
      exhibits: [
        { exhibitId: "A", redactionStatus: "contains-pii" },
        { exhibitId: "B", redactionStatus: "contains-pii" },
        { exhibitId: "C", redactionStatus: "contains-pii" },
      ],
    };
    const r = enforceSandboxRules(draft);
    expect(r.ok).toBe(true);
    expect(r.corrections).toHaveLength(3);
    for (const ex of draft.exhibits) {
      expect(ex.redactionStatus).toBe("synthetic-pii-placeholder");
    }
  });
});
