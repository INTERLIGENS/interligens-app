import { describe, it, expect } from "vitest";
import {
  buildXDraft,
  buildPublicStatementDraft,
  buildInternalNoteDraft,
  buildDraftSet,
} from "./drafts";

const baseInput = {
  incident: {
    title: "Vercel internal systems breach",
    summaryShort:
      "ShinyHunters claimed unauthorized access on BreachForums.",
    incidentType: "breach",
    severity: "critical" as const,
    detectedAt: new Date("2026-04-19T19:00:00Z"),
    vendorName: "Vercel",
    sourceUrl: "https://breachforums.st/",
  },
  exposure: {
    exposureLevel: "possible" as const,
    affectedSummary: "Every production env var + source code.",
    rotatedKeys: true,
    reviewedAccess: false,
    reviewedLogs: false,
  },
};

describe("buildXDraft", () => {
  it("fits within 280 characters", () => {
    const d = buildXDraft(baseInput);
    expect(d.body.length).toBeLessThanOrEqual(280);
  });

  it("mentions the vendor and the status blurb", () => {
    const d = buildXDraft(baseInput);
    expect(d.body).toContain("Vercel");
    expect(d.body).toMatch(/mitigat|appl|review/i);
  });
});

describe("buildPublicStatementDraft", () => {
  it("contains date + vendor + action summary", () => {
    const d = buildPublicStatementDraft(baseInput);
    expect(d.body).toContain("2026-04-19");
    expect(d.body).toContain("Vercel");
    expect(d.body).toMatch(/credential/i); // "rotated every credential tied to the affected vendor"
    expect(d.title).toBe("Vercel internal systems breach — INTERLIGENS assessment");
  });

  it("omits absent mitigations from the actions block", () => {
    const d = buildPublicStatementDraft({
      ...baseInput,
      exposure: {
        ...baseInput.exposure,
        rotatedKeys: false,
        reviewedAccess: false,
        reviewedLogs: false,
      },
    });
    expect(d.body.toLowerCase()).toContain("mitigation steps");
  });
});

describe("buildInternalNoteDraft", () => {
  it("is structured with bullets", () => {
    const d = buildInternalNoteDraft(baseInput);
    expect(d.body).toContain("· Type: breach");
    expect(d.body).toContain("· Severity: CRITICAL");
    expect(d.body).toContain("· Vendor: Vercel");
  });

  it("title uses SEC prefix with date", () => {
    const d = buildInternalNoteDraft(baseInput);
    expect(d.title).toMatch(/^\[SEC-2026-04-19\]/);
  });
});

describe("buildDraftSet", () => {
  it("returns the three canonical drafts in order", () => {
    const set = buildDraftSet(baseInput);
    expect(set.map((d) => d.channel)).toEqual([
      "x",
      "public_status",
      "internal",
    ]);
  });

  it("every draft has tone=factual", () => {
    const set = buildDraftSet(baseInput);
    for (const d of set) expect(d.tone).toBe("factual");
  });
});
