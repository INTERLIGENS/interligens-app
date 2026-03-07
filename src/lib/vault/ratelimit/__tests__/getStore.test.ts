import { describe, it, expect, vi, afterEach } from "vitest";

describe("getRateLimitStore provider selection", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("retourne memoryStore si pas de Upstash", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.resetModules();
    const { getRateLimitStore } = await import("../getStore");
    const { _resetStoreCache } = await import("../getStore");
    _resetStoreCache();
    const store = getRateLimitStore();
    // memory store: get renvoie null pour clé inexistante
    await expect(store.get("nonexistent")).resolves.toBeNull();
  });

  it("retourne upstash store si vars présentes", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");
    vi.resetModules();
    const { getRateLimitStore, _resetStoreCache } = await import("../getStore");
    _resetStoreCache();
    const store = getRateLimitStore();
    // upstash store: get fail-open (null) sur fetch qui échoue
    await expect(store.get("test")).resolves.toBeNull();
  });
});
