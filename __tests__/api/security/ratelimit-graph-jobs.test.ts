// cc-offline-51 #1 — /api/scan/solana/graph/jobs rate-limit (Helius cost)
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/solanaGraph/scheduler", () => ({
  createJob: vi.fn((q: any, p: any) => ({
    id: "job_test", status: "PENDING", priority: p ?? "NORMAL", query: q, created_at: "t",
  })),
  enqueueJob: vi.fn().mockResolvedValue(undefined),
  processNextJob: vi.fn().mockResolvedValue(null),
}));
// imported by the route but unused in the handler — mock to avoid side effects
vi.mock("@/lib/vault/vaultLookup", () => ({ vaultLookup: vi.fn() }));
vi.mock("@/lib/vault/auditScan", () => ({ auditScanLookup: vi.fn() }));

import { POST } from "@/app/api/scan/solana/graph/jobs/route";
import * as scheduler from "@/lib/solanaGraph/scheduler";
import { NextRequest } from "next/server";

const enqueue = scheduler.enqueueJob as unknown as ReturnType<typeof vi.fn>;

function req(ip: string): NextRequest {
  return new NextRequest(
    new Request("http://localhost/api/scan/solana/graph/jobs", {
      method: "POST",
      headers: { "x-real-ip": ip, "content-type": "application/json" },
      body: JSON.stringify({ mint: "So11111111111111111111111111111111111111112" }),
    }),
  );
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/scan/solana/graph/jobs — rate-limit (checkScanLimit, 60/5min/IP)", () => {
  it("lets a legit single request through (202, job enqueued)", async () => {
    const res = await POST(req("10.0.0.1"));
    expect(res.status).toBe(202);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("returns 429 on burst (N+1) and does NOT enqueue / call Helius", async () => {
    const ip = "10.0.0.2";
    for (let i = 0; i < 60; i++) {
      const r = await POST(req(ip));
      expect(r.status).toBe(202);
    }
    const before = enqueue.mock.calls.length;
    const r = await POST(req(ip));
    expect(r.status).toBe(429);
    // the 429 path must not enqueue a job (no Helius work)
    expect(enqueue.mock.calls.length).toBe(before);
  });
});
