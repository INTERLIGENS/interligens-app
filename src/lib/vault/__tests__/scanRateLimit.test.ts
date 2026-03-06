// src/lib/vault/__tests__/scanRateLimit.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

// Reset module between tests to clear in-memory store
describe("scanRateLimit", () => {
  it("permet les premières requêtes", async () => {
    const { checkScanLimit } = await import("../scanRateLimit");
    const result = checkScanLimit("1.2.3.4");
    expect(result.allowed).toBe(true);
  });

  it("bloque après dépassement du seuil", async () => {
    vi.resetModules();
    // Mock ENV to low limit
    process.env.SCAN_RATE_LIMIT = "3";
    process.env.RATE_WINDOW_MS = "60000";
    const { checkScanLimit } = await import("../scanRateLimit");
    const ip = "5.5.5.5";
    checkScanLimit(ip); // 1
    checkScanLimit(ip); // 2
    checkScanLimit(ip); // 3
    const result = checkScanLimit(ip); // 4 -> blocked
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    delete process.env.SCAN_RATE_LIMIT;
    delete process.env.RATE_WINDOW_MS;
  });
});
