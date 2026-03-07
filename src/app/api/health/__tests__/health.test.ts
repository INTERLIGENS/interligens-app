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
import { NextRequest } from "next/server";

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
});
