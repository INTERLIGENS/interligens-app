// cc-offline-51 #2 — /api/reflex/[id]/watch rate-limit (unauth DB write)
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { reflexWatch: { create: vi.fn() } } }));
vi.mock("@/lib/reflex/persistence", () => ({ findById: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { findById } from "@/lib/reflex/persistence";
import { __resetStoreForTest } from "@/lib/security/rateLimit";
import { POST } from "@/app/api/reflex/[id]/watch/route";
import { NextRequest } from "next/server";

const mockFindById = vi.mocked(findById as unknown as (...a: unknown[]) => unknown);
const mockCreate = vi.mocked(prisma.reflexWatch.create as unknown as (...a: unknown[]) => unknown);

function req(ip: string): NextRequest {
  return new NextRequest(
    new Request("http://localhost/api/reflex/x/watch", {
      method: "POST",
      headers: { "x-real-ip": ip, "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  __resetStoreForTest();
});

describe("POST /api/reflex/[id]/watch — rate-limit (30/min/IP)", () => {
  it("lets a legit single request through (200, watch created)", async () => {
    mockFindById.mockResolvedValue({ input: { address: "0xabc", type: "WALLET", chain: "ethereum" } });
    mockCreate.mockResolvedValue({
      id: "w1", target: "0xabc", targetType: "WALLET", chain: "ethereum",
      expiresAt: new Date("2026-08-01T00:00:00Z"), status: "ACTIVE",
    });
    const res = await POST(req("10.1.0.1"), ctx("analysis-1"));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("returns 429 on burst (N+1) without writing", async () => {
    mockFindById.mockResolvedValue(null); // 404 path — rate-limit still counts first
    const ip = "10.1.0.2";
    for (let i = 0; i < 30; i++) {
      const r = await POST(req(ip), ctx("x"));
      expect(r.status).toBe(404);
    }
    const r = await POST(req(ip), ctx("x"));
    expect(r.status).toBe(429);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
