import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock prisma to avoid any DB import at module load.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    betaFounderAccess: { findFirst: vi.fn(), updateMany: vi.fn() },
    billingCustomer: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
    investigatorAuditLog: { create: vi.fn() },
    $transaction: vi.fn(async () => "r_x"),
  },
}));

import { POST as createCheckout } from "@/app/api/billing/create-checkout-session/route";
import { POST as waitlist } from "@/app/api/billing/waitlist/route";
import { POST as webhook } from "@/app/api/stripe/webhook/route";
import { NextRequest } from "next/server";

const ORIG_FLAG = process.env.BILLING_ENABLED;

describe("Feature flag — BILLING_ENABLED=false", () => {
  beforeEach(() => {
    process.env.BILLING_ENABLED = "false";
  });
  afterEach(() => {
    process.env.BILLING_ENABLED = ORIG_FLAG;
  });

  it("create-checkout-session returns 404", async () => {
    const req = new NextRequest("http://localhost/api/billing/create-checkout-session", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com" }),
    });
    const res = await createCheckout(req);
    expect(res.status).toBe(404);
  });

  it("waitlist returns 404", async () => {
    const req = new NextRequest("http://localhost/api/billing/waitlist", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.com" }),
    });
    const res = await waitlist(req);
    expect(res.status).toBe(404);
  });

  it("webhook remains reachable even when flag is off", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });
    const res = await webhook(req);
    // No secret configured → 500 webhook_not_configured (NOT a 404). This
    // proves the route is wired and not gated by BILLING_ENABLED.
    expect(res.status).toBe(500);
  });
});
