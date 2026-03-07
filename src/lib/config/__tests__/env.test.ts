import { describe, it, expect, vi, afterEach } from "vitest";

describe("env guards", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("hasRedis() false si vars absentes", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const { hasRedis } = await import("../env");
    expect(hasRedis()).toBe(false);
  });

  it("hasS3() false si vars absentes", async () => {
    vi.stubEnv("RAWDOCS_S3_ENDPOINT", "");
    vi.stubEnv("RAWDOCS_S3_BUCKET", "");
    const { hasS3 } = await import("../env");
    expect(hasS3()).toBe(false);
  });
});
