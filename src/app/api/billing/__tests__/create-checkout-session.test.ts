import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Each external collaborator is mocked. The route never touches a real
// Stripe, Redis, Turnstile or database.

vi.mock("@/lib/prisma", () => ({
  prisma: {
    betaFounderAccess: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    billingCustomer: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
    investigatorAuditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const { checkCheckoutRateLimitsMock, lookupCustomerMock, stripeCreate } = vi.hoisted(() => ({
  checkCheckoutRateLimitsMock: vi.fn(),
  lookupCustomerMock: vi.fn(),
  stripeCreate: vi.fn(),
}));

vi.mock("@/lib/billing/turnstile", () => ({
  verifyTurnstile: vi.fn(async (t: string | null) =>
    t === "good" ? { ok: true } : { ok: false, reason: "rejected" },
  ),
}));

vi.mock("@/lib/billing/rateLimit", () => ({
  checkCheckoutRateLimits: checkCheckoutRateLimitsMock,
}));

vi.mock("@/lib/billing/customerLookup", () => ({
  lookupOrCreateStripeCustomer: lookupCustomerMock,
}));

vi.mock("@/lib/billing/stripeClient", () => ({
  getStripe: () => ({ checkout: { sessions: { create: stripeCreate } } }),
}));

import { POST } from "@/app/api/billing/create-checkout-session/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

const findFirst = prisma.betaFounderAccess.findFirst as unknown as ReturnType<typeof vi.fn>;
const updateMany = prisma.betaFounderAccess.updateMany as unknown as ReturnType<typeof vi.fn>;
const update = prisma.betaFounderAccess.update as unknown as ReturnType<typeof vi.fn>;
const $transaction = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;

const ORIG_FLAG = process.env.BILLING_ENABLED;
const ORIG_CAP = process.env.BETA_FOUNDER_CAP;

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/billing/create-checkout-session", {
    method: "POST",
    headers: { "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.BILLING_ENABLED = "true";
  process.env.BETA_FOUNDER_CAP = "10";
  delete process.env.BETA_CAP_REACHED;

  findFirst.mockReset();
  updateMany.mockReset().mockResolvedValue({ count: 0 });
  update.mockReset();
  $transaction.mockReset();
  checkCheckoutRateLimitsMock.mockReset().mockResolvedValue({ ok: true, remaining: 3, resetAt: 0 });
  lookupCustomerMock.mockReset().mockResolvedValue({ stripeCustomerId: "cus_x", created: false });
  stripeCreate.mockReset().mockResolvedValue({ id: "cs_x", url: "https://stripe/x" });
});

afterEach(() => {
  process.env.BILLING_ENABLED = ORIG_FLAG;
  process.env.BETA_FOUNDER_CAP = ORIG_CAP;
});

describe("POST /api/billing/create-checkout-session", () => {
  it("rejects invalid email (400)", async () => {
    const res = await POST(req({ email: "x", turnstileToken: "good" }));
    expect(res.status).toBe(400);
  });

  it("rejects when Turnstile fails (400)", async () => {
    const res = await POST(req({ email: "a@b.com", turnstileToken: "bad" }));
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe("turnstile_failed");
  });

  it("returns 429 when rate-limited", async () => {
    checkCheckoutRateLimitsMock.mockResolvedValue({ ok: false, remaining: 0, resetAt: 0 });
    const res = await POST(req({ email: "a@b.com", turnstileToken: "good" }));
    expect(res.status).toBe(429);
  });

  it("reuses an existing non-expired pending reservation (idempotence)", async () => {
    findFirst.mockResolvedValue({
      id: "r_existing",
      stripeCheckoutSessionUrl: "https://stripe/existing",
    });
    const res = await POST(req({ email: "a@b.com", turnstileToken: "good" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { url?: string };
    expect(data.url).toBe("https://stripe/existing");
    expect(stripeCreate).not.toHaveBeenCalled();
  });

  it("returns 409 sold_out when cap is reached", async () => {
    findFirst.mockResolvedValue(null);
    const err = new Error("cap") as Error & { code?: string };
    err.code = "sold_out";
    $transaction.mockRejectedValue(err);
    const res = await POST(req({ email: "a@b.com", turnstileToken: "good" }));
    expect(res.status).toBe(409);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe("sold_out");
  });

  it("creates Stripe Checkout Session and returns its url", async () => {
    findFirst.mockResolvedValue(null);
    $transaction.mockResolvedValue("r_new");
    update.mockResolvedValue({});
    const res = await POST(req({ email: "a@b.com", turnstileToken: "good" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { url?: string };
    expect(data.url).toBe("https://stripe/x");
    expect(stripeCreate).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r_new" },
        data: expect.objectContaining({
          stripeCheckoutSession: "cs_x",
          stripeCheckoutSessionUrl: "https://stripe/x",
        }),
      }),
    );
  });
});
