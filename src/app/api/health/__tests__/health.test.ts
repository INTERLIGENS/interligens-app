// @pr5:monitoring
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]) },
}));

vi.mock("@/lib/config/env", () => ({
  hasRedis: () => false,
  hasS3: () => false,
  env: { NODE_ENV: "test", UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "" },
}));

import { GET } from "../route";

describe("/api/health", () => {
  it("retourne ok=true si DB répond", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.db).toBe("ok");
    expect(body.redis).toBe("disabled");
    expect(body.rawdocs).toBe("disabled");
  });

  it("retourne version, timestamp, duration_ms", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.version).toBeDefined();
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof body.duration_ms).toBe("number");
    expect(body.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("header Cache-Control = no-store", async () => {
    const res = await GET();
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("header X-Health-OK = 1 si ok", async () => {
    const res = await GET();
    expect(res.headers.get("x-health-ok")).toBe("1");
  });

  it("retourne 503 si DB fail", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("DB down"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.db).toBe("fail");
  });
});
