import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRateLimit, RATE_LIMIT_PRESETS, __resetStoreForTest } from "../rateLimit";

describe("Rate Limit — fail-closed PDF when Upstash down", () => {
  beforeEach(() => {
    __resetStoreForTest();
    // Simuler Upstash configuré mais DOWN
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "http://invalid.upstash.invalid");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");
    // Mock fetch pour simuler erreur réseau
    vi.stubGlobal("fetch", async () => new Response(null, { status: 503 }));
  });

  it("PDF: fail-CLOSED quand Redis down (retourne allowed=false)", async () => {
    const result = await checkRateLimit("1.2.3.4", RATE_LIMIT_PRESETS.pdf);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("SCAN: fail-OPEN quand Redis down (retourne allowed=true)", async () => {
    const result = await checkRateLimit("1.2.3.4", RATE_LIMIT_PRESETS.scan);
    expect(result.allowed).toBe(true);
  });

  it("OSINT: fail-OPEN quand Redis down (retourne allowed=true)", async () => {
    const result = await checkRateLimit("1.2.3.4", RATE_LIMIT_PRESETS.osint);
    expect(result.allowed).toBe(true);
  });
});
