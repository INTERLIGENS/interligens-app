import { describe, it, expect, vi, beforeEach } from "vitest";
import { logEvent } from "../logger";
import { logScan, logPageView, logError, logPartnerApi } from "../events";

describe("analytics/logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("logEvent writes valid JSON to console", () => {
    logEvent({ type: "SCAN", timestamp: "2026-05-01T00:00:00.000Z", data: { address: "So1111" } });
    const call = (console.log as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.type).toBe("SCAN");
    expect(parsed.data.address).toBe("So1111");
    expect(parsed.timestamp).toBe("2026-05-01T00:00:00.000Z");
  });

  it("logScan emits SCAN event with correct fields", () => {
    logScan({ address: "abc", chain: "SOL", score: 72, tier: "RED", source: "scan", duration_ms: 450 });
    const call = (console.log as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.type).toBe("SCAN");
    expect(parsed.data.score).toBe(72);
    expect(parsed.data.tier).toBe("RED");
    expect(parsed.data.duration_ms).toBe(450);
  });

  it("logPageView emits PAGE_VIEW event", () => {
    logPageView({ source: "demo" });
    const call = (console.log as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.type).toBe("PAGE_VIEW");
    expect(parsed.data.source).toBe("demo");
  });

  it("logError emits ERROR event with error message", () => {
    logError({ error: "Rate limit exceeded", source: "partner" });
    const call = (console.log as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.type).toBe("ERROR");
    expect(parsed.data.error).toBe("Rate limit exceeded");
  });

  it("logPartnerApi emits PARTNER_API event", () => {
    logPartnerApi({ address: "xyz", chain: "ETH", score: 20, tier: "GREEN", duration_ms: 200 });
    const call = (console.log as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(call);
    expect(parsed.type).toBe("PARTNER_API");
    expect(parsed.data.chain).toBe("ETH");
    expect(parsed.data.score).toBe(20);
  });
});
