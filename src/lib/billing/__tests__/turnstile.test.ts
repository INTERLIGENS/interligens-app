import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { verifyTurnstile } from "../turnstile";

describe("verifyTurnstile", () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.TURNSTILE_SECRET;

  beforeEach(() => {
    process.env.TURNSTILE_SECRET = "test-secret";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.TURNSTILE_SECRET = originalSecret;
  });

  it("rejects when secret is not configured", async () => {
    delete process.env.TURNSTILE_SECRET;
    delete process.env.TURNSTILE_SECRET_KEY;
    const res = await verifyTurnstile("abc");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("missing_secret");
  });

  it("rejects when token is missing", async () => {
    const res = await verifyTurnstile(null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("missing_token");
  });

  it("accepts when Cloudflare reports success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    }) as unknown as typeof fetch;
    const res = await verifyTurnstile("good", "1.2.3.4");
    expect(res.ok).toBe(true);
  });

  it("rejects when Cloudflare reports failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: false, "error-codes": ["invalid"] }),
    }) as unknown as typeof fetch;
    const res = await verifyTurnstile("bad");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("rejected");
  });

  it("rejects on network errors", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("net")) as unknown as typeof fetch;
    const res = await verifyTurnstile("token");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("network");
  });
});
