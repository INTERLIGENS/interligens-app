// cc-offline-51 #3 — /api/v1/mm/challenge rate-limit (unauth write + DNS precheck)
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mmEntity: { findUnique: vi.fn() },
    mmClaim: { findUnique: vi.fn() },
    mmAttribution: { findUnique: vi.fn() },
    mmChallenge: { create: vi.fn() },
  },
}));
vi.mock("@/lib/mm/email/dkim", () => ({ dkimPrecheck: vi.fn() }));
vi.mock("@/lib/mm/registry/reviewLog", () => ({ writeReviewLog: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { __resetStoreForTest } from "@/lib/security/rateLimit";
import { POST } from "@/app/api/v1/mm/challenge/route";
import { NextRequest } from "next/server";

const mockCreate = vi.mocked(prisma.mmChallenge.create as unknown as (...a: unknown[]) => unknown);

// minimal body — rate-limit is checked BEFORE validation, so an invalid body
// (400) still exercises/counts the limiter.
function req(ip: string): NextRequest {
  return new NextRequest(
    new Request("http://localhost/api/v1/mm/challenge", {
      method: "POST",
      headers: { "x-real-ip": ip, "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetStoreForTest();
});

describe("POST /api/v1/mm/challenge — rate-limit (30/min/IP)", () => {
  it("does NOT rate-limit a legit single request (passes to validation, not 429)", async () => {
    const res = await POST(req("10.2.0.1"));
    expect(res.status).not.toBe(429);
    expect(res.status).toBe(400); // invalid_target_type — reached validation, not blocked
  });

  it("returns 429 on burst (N+1) without writing", async () => {
    const ip = "10.2.0.2";
    for (let i = 0; i < 30; i++) {
      const r = await POST(req(ip));
      expect(r.status).toBe(400); // passes limiter, fails validation
    }
    const r = await POST(req(ip));
    expect(r.status).toBe(429);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
