import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { constructEvent } = vi.hoisted(() => ({ constructEvent: vi.fn() }));

vi.mock("@/lib/billing/stripeClient", () => ({
  getStripe: () => ({ webhooks: { constructEvent } }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    billingEvent: { create: vi.fn() },
    investigatorAuditLog: { create: vi.fn() },
    betaFounderAccess: { findUnique: vi.fn(), findFirst: vi.fn() },
  },
}));

import { POST as webhook } from "@/app/api/stripe/webhook/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

const ORIG = process.env.STRIPE_WEBHOOK_SECRET;
const billingEventCreate = prisma.billingEvent.create as unknown as ReturnType<typeof vi.fn>;

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    constructEvent.mockReset();
    billingEventCreate.mockReset();
  });

  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = ORIG;
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });
    const res = await webhook(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 on signature verification failure", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad");
    });
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=deadbeef" },
      body: "{}",
    });
    const res = await webhook(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 ok=true on a recognized event", async () => {
    constructEvent.mockReturnValue({
      id: "evt_1",
      type: "checkout.session.expired",
      data: { object: { id: "cs_x" } },
    });
    billingEventCreate.mockResolvedValue({});
    (prisma.betaFounderAccess.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    // updateMany not on the mocked object for this test; we don't need it
    // here since the handler short-circuits when findUnique returns null
    // in some paths. We rely on the route returning 200 even if the handler
    // returns "no_reservation".
    // Stub updateMany via dynamic property in case it's accessed.
    (prisma.betaFounderAccess as unknown as { updateMany?: ReturnType<typeof vi.fn> }).updateMany =
      vi.fn().mockResolvedValue({ count: 0 });

    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=test" },
      body: "{}",
    });
    const res = await webhook(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; outcome?: string };
    expect(body.ok).toBe(true);
  });

  it("returns 200 duplicate:true on a duplicate stripeEventId", async () => {
    constructEvent.mockReturnValue({
      id: "evt_dup",
      type: "checkout.session.completed",
      data: { object: {} },
    });
    const dup = new Error("dup") as Error & { code?: string };
    dup.code = "P2002";
    billingEventCreate.mockRejectedValue(dup);
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=test" },
      body: "{}",
    });
    const res = await webhook(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { duplicate?: boolean };
    expect(body.duplicate).toBe(true);
  });

  it("returns 500 when STRIPE_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });
    const res = await webhook(req);
    expect(res.status).toBe(500);
  });
});
