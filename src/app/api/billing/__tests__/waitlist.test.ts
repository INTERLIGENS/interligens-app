import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    waitlistEntry: { create: vi.fn() },
    investigatorAuditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/billing/turnstile", () => ({
  verifyTurnstile: vi.fn(async (t: string | null) =>
    t === "good" ? { ok: true } : { ok: false, reason: "rejected" },
  ),
}));

vi.mock("@/lib/billing/rateLimit", () => ({
  checkWaitlistRateLimit: vi.fn(async () => ({ ok: true, remaining: 5, resetAt: 0 })),
}));

import { POST as waitlist } from "@/app/api/billing/waitlist/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

const create = prisma.waitlistEntry.create as unknown as ReturnType<typeof vi.fn>;
const ORIG = process.env.BILLING_ENABLED;

describe("POST /api/billing/waitlist", () => {
  beforeEach(() => {
    process.env.BILLING_ENABLED = "true";
    create.mockReset();
  });
  afterEach(() => {
    process.env.BILLING_ENABLED = ORIG;
  });

  it("rejects invalid email", async () => {
    const req = new NextRequest("http://localhost/api/billing/waitlist", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email", turnstileToken: "good" }),
    });
    const res = await waitlist(req);
    expect(res.status).toBe(400);
  });

  it("rejects bad Turnstile token", async () => {
    const req = new NextRequest("http://localhost/api/billing/waitlist", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", turnstileToken: "bad" }),
    });
    const res = await waitlist(req);
    expect(res.status).toBe(400);
  });

  it("dedupes existing email (P2002) as success", async () => {
    const e = new Error("dup") as Error & { code?: string };
    e.code = "P2002";
    create.mockRejectedValue(e);
    const req = new NextRequest("http://localhost/api/billing/waitlist", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com", turnstileToken: "good" }),
    });
    const res = await waitlist(req);
    expect(res.status).toBe(200);
  });

  it("inserts new email and returns ok:true", async () => {
    create.mockResolvedValue({ id: "w_1" });
    const req = new NextRequest("http://localhost/api/billing/waitlist", {
      method: "POST",
      body: JSON.stringify({ email: "new@x.com", turnstileToken: "good" }),
    });
    const res = await waitlist(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok?: boolean };
    expect(data.ok).toBe(true);
  });
});
