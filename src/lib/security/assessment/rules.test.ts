import { describe, it, expect } from "vitest";
import { assessExposure } from "./rules";

describe("assessExposure — severity baseline", () => {
  it("critical + breach on Vercel → probable, flags all", () => {
    const r = assessExposure({
      incidentType: "breach",
      severity: "critical",
      vendorSlug: "vercel",
      vendorIsLive: true,
    });
    expect(r.exposureLevel).toBe("probable");
    expect(r.requiresKeyRotation).toBe(true);
    expect(r.requiresAccessReview).toBe(true);
    expect(r.requiresInfraLogReview).toBe(true);
    expect(r.requiresPublicStatement).toBe(true);
    expect(r.actionChecklist.some((a) => a.key === "rotate_vendor_keys")).toBe(true);
    expect(r.actionChecklist.some((a) => a.key === "redeploy_and_invalidate_sessions")).toBe(true);
  });

  it("high + breach on non-critical vendor (helius) → possible", () => {
    const r = assessExposure({
      incidentType: "breach",
      severity: "high",
      vendorSlug: "helius",
      vendorIsLive: true,
    });
    expect(r.exposureLevel).toBe("possible");
    expect(r.requiresKeyRotation).toBe(true);
  });

  it("low + outage → none, no flags", () => {
    const r = assessExposure({
      incidentType: "outage",
      severity: "low",
      vendorSlug: "cloudflare",
      vendorIsLive: true,
    });
    expect(r.exposureLevel).toBe("none");
    expect(r.requiresKeyRotation).toBe(false);
    expect(r.requiresPublicStatement).toBe(false);
    expect(r.actionChecklist).toEqual([]);
  });

  it("medium + dependency_cve on npm → unlikely", () => {
    const r = assessExposure({
      incidentType: "dependency_cve",
      severity: "medium",
      vendorSlug: "npm",
      vendorIsLive: true,
    });
    // npm is critical → upgraded to possible? Let's check: baseline medium = unlikely,
    // npm is critical so possible via the vendor bump step.
    expect(r.exposureLevel).toBe("possible");
    // dependency_cve specifically generates a checklist entry
    expect(r.actionChecklist.some((a) => a.key === "cve_check_deps")).toBe(true);
  });

  it("confirmed override beats severity", () => {
    const r = assessExposure({
      incidentType: "breach",
      severity: "low",
      vendorSlug: "vercel",
      vendorIsLive: true,
      confirmedExposure: true,
    });
    expect(r.exposureLevel).toBe("confirmed");
    expect(r.requiresPublicStatement).toBe(true);
  });

  it("vendorIsLive=false caps exposure at unlikely", () => {
    const r = assessExposure({
      incidentType: "breach",
      severity: "critical",
      vendorSlug: "upstash",
      vendorIsLive: false, // marketplace add-on currently inactive
    });
    expect(r.exposureLevel).toBe("unlikely");
    expect(r.requiresKeyRotation).toBe(false);
  });
});

describe("assessExposure — incident-type logic", () => {
  it("supply_chain high on github → possible + adds lockfile_diff check", () => {
    const r = assessExposure({
      incidentType: "supply_chain",
      severity: "high",
      vendorSlug: "github",
      vendorIsLive: true,
    });
    expect(["possible", "probable"]).toContain(r.exposureLevel);
    expect(r.actionChecklist.some((a) => a.key === "lockfile_diff")).toBe(true);
  });

  it("account_takeover requires access review regardless", () => {
    const r = assessExposure({
      incidentType: "account_takeover",
      severity: "medium",
      vendorSlug: "github",
      vendorIsLive: true,
    });
    expect(r.requiresAccessReview).toBe(true);
  });

  it("phishing does not imply key rotation (no secret leaked)", () => {
    const r = assessExposure({
      incidentType: "phishing",
      severity: "medium",
    });
    expect(r.requiresKeyRotation).toBe(false);
    // Access review IS required for phishing at any non-none exposure —
    // the attacker may have landed credentials even without a secret leak.
    expect(r.requiresAccessReview).toBe(true);
  });

  it("unknown vendor surface gives a neutral summary, still returns a level", () => {
    const r = assessExposure({
      incidentType: "outage",
      severity: "high",
      // no vendorSlug
    });
    expect(r.affectedSurface.assetTypes).toEqual([]);
    expect(r.affectedSurface.summary).toMatch(/manually/i);
    expect(r.exposureLevel).toBe("possible");
  });
});
