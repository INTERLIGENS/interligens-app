import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildDigest, sendDigest } from "./digest";

function row(over: Partial<Parameters<typeof buildDigest>[0]["newIncidents"][0]> = {}) {
  return {
    id: "inc_x",
    title: "Vercel breach",
    summaryShort: "Short summary.",
    incidentType: "breach",
    severity: "critical" as const,
    status: "mitigated",
    detectedAt: new Date("2026-04-19T19:00:00Z"),
    vendorName: "Vercel",
    exposureLevel: "possible" as const,
    ...over,
  };
}

describe("buildDigest — structure + counts", () => {
  it("returns subject with the period-end date", () => {
    const d = buildDigest({
      periodStart: new Date("2026-04-14T00:00:00Z"),
      periodEnd: new Date("2026-04-21T00:00:00Z"),
      newIncidents: [],
      criticalIncidents: [],
      openActionItems: [],
      exposureHighlights: [],
    });
    expect(d.subject).toContain("INTERLIGENS");
    expect(d.subject).toContain("2026-04-21");
  });

  it("includes every new incident in html and text", () => {
    const d = buildDigest({
      periodStart: new Date("2026-04-14T00:00:00Z"),
      periodEnd: new Date("2026-04-21T00:00:00Z"),
      newIncidents: [row()],
      criticalIncidents: [],
      openActionItems: [],
      exposureHighlights: [],
    });
    expect(d.includedIncidentCount).toBe(1);
    expect(d.bodyHtml).toContain("Vercel breach");
    expect(d.bodyText).toContain("Vercel breach");
    expect(d.bodyText).toContain("CRITICAL"); // severity upcased in text
  });

  it("highlights critical incidents in their own block", () => {
    const d = buildDigest({
      periodStart: new Date("2026-04-14T00:00:00Z"),
      periodEnd: new Date("2026-04-21T00:00:00Z"),
      newIncidents: [row()],
      criticalIncidents: [row()],
      openActionItems: [],
      exposureHighlights: [],
    });
    expect(d.includedCriticalCount).toBe(1);
    expect(d.bodyHtml).toContain("Critical / high severity");
  });

  it("escapes HTML in incident titles", () => {
    const d = buildDigest({
      periodStart: new Date("2026-04-14T00:00:00Z"),
      periodEnd: new Date("2026-04-21T00:00:00Z"),
      newIncidents: [row({ title: "<script>alert(1)</script>" })],
      criticalIncidents: [],
      openActionItems: [],
      exposureHighlights: [],
    });
    expect(d.bodyHtml).toContain("&lt;script&gt;");
    expect(d.bodyHtml).not.toContain("<script>alert(1)</script>");
  });

  it("handles empty period gracefully", () => {
    const d = buildDigest({
      periodStart: new Date("2026-04-14T00:00:00Z"),
      periodEnd: new Date("2026-04-21T00:00:00Z"),
      newIncidents: [],
      criticalIncidents: [],
      openActionItems: [],
      exposureHighlights: [],
    });
    expect(d.bodyText).toContain("No new vendor incidents");
    expect(d.includedIncidentCount).toBe(0);
  });
});

describe("sendDigest — Resend wrapper", () => {
  const originalKey = process.env.RESEND_API_KEY;
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
  });
  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("skips when no API key", async () => {
    delete process.env.RESEND_API_KEY;
    const spy = vi.spyOn(global, "fetch");
    const r = await sendDigest({
      subject: "x",
      bodyHtml: "<p/>",
      bodyText: "x",
      includedIncidentCount: 0,
      includedCriticalCount: 0,
    });
    expect(r.delivered).toBe(false);
    expect(r.skipped).toBe("no_api_key");
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns delivered:true on 200 and extracts id", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "em_abc" }), { status: 200 }),
    );
    const r = await sendDigest({
      subject: "x",
      bodyHtml: "<p/>",
      bodyText: "x",
      includedIncidentCount: 0,
      includedCriticalCount: 0,
    });
    expect(r.delivered).toBe(true);
    expect(r.resendId).toBe("em_abc");
  });

  it("returns delivered:false on 429", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("rate limited", { status: 429 }),
    );
    const r = await sendDigest({
      subject: "x",
      bodyHtml: "<p/>",
      bodyText: "x",
      includedIncidentCount: 0,
      includedCriticalCount: 0,
    });
    expect(r.delivered).toBe(false);
    expect(r.error).toBe("resend_429");
  });
});
