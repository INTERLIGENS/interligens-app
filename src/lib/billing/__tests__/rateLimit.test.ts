import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, checkCheckoutRateLimits, checkWaitlistRateLimit } from "../rateLimit";

const ORIG_URL = process.env.UPSTASH_REDIS_REST_URL;
const ORIG_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

describe("rateLimit", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test";
  });

  afterEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = ORIG_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = ORIG_TOKEN;
    vi.restoreAllMocks();
  });

  it("fails open when UPSTASH_REDIS_REST_URL is missing", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    const res = await checkRateLimit({
      bucket: "test",
      key: "x",
      limit: 3,
      windowSeconds: 60,
    });
    expect(res.ok).toBe(true);
    expect(res.bypass).toBe("no_url");
  });

  it("blocks when INCR returns above limit", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ result: 4 }, { result: 1 }]),
    }) as unknown as typeof fetch;
    const res = await checkRateLimit({ bucket: "b", key: "k", limit: 3, windowSeconds: 60 });
    expect(res.ok).toBe(false);
  });

  it("allows when INCR returns within limit", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ result: 2 }, { result: 1 }]),
    }) as unknown as typeof fetch;
    const res = await checkRateLimit({ bucket: "b", key: "k", limit: 3, windowSeconds: 60 });
    expect(res.ok).toBe(true);
    expect(res.remaining).toBe(1);
  });

  it("checkCheckoutRateLimits returns first failing rule", async () => {
    let call = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      call += 1;
      const count = call === 1 ? 99 : 1; // IP rule blows first
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ result: count }, { result: 1 }]),
      });
    }) as unknown as typeof fetch;
    const res = await checkCheckoutRateLimits({ ip: "1.1.1.1", email: "a@b.com" });
    expect(res.ok).toBe(false);
  });

  it("checkWaitlistRateLimit chains IP then email", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ result: 1 }, { result: 1 }]),
    }) as unknown as typeof fetch;
    const res = await checkWaitlistRateLimit({ ip: "1.1.1.1", email: "a@b.com" });
    expect(res.ok).toBe(true);
  });
});
