import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    betaFounderAccess: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    billingCustomer: { upsert: vi.fn() },
    billingEvent: { create: vi.fn() },
    entitlement: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    investigatorAuditLog: { create: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

vi.mock("../grantAccess", () => ({
  provisionBetaFounderAccess: vi.fn(async () => ({
    investigatorAccessId: "acc_new",
    emailDelivered: "skipped",
  })),
}));

import { prisma } from "@/lib/prisma";
import {
  recordEventIfNew,
  handleCheckoutSessionCompleted,
  handleCheckoutSessionExpired,
  handlePaymentIntentFailed,
  handleChargeRefunded,
  handleChargeDisputeCreated,
  handleChargeDisputeClosed,
} from "../webhookHandlers";

type AnyFn = ReturnType<typeof vi.fn>;
const bfaFindUnique = prisma.betaFounderAccess.findUnique as unknown as AnyFn;
const bfaFindFirst = prisma.betaFounderAccess.findFirst as unknown as AnyFn;
const bfaUpdate = prisma.betaFounderAccess.update as unknown as AnyFn;
const bfaUpdateMany = prisma.betaFounderAccess.updateMany as unknown as AnyFn;
const evCreate = prisma.billingEvent.create as unknown as AnyFn;
const entFindFirst = prisma.entitlement.findFirst as unknown as AnyFn;
const entCreate = prisma.entitlement.create as unknown as AnyFn;
const entUpdateMany = prisma.entitlement.updateMany as unknown as AnyFn;

function mockReset() {
  [
    bfaFindUnique,
    bfaFindFirst,
    bfaUpdate,
    bfaUpdateMany,
    evCreate,
    entFindFirst,
    entCreate,
    entUpdateMany,
  ].forEach((m) => m.mockReset());
}

beforeEach(mockReset);

describe("recordEventIfNew", () => {
  it("returns true on first insert", async () => {
    evCreate.mockResolvedValue({});
    const ok = await recordEventIfNew({ id: "evt_1", type: "checkout.session.completed" as never }, "payload");
    expect(ok).toBe(true);
  });

  it("returns false on Prisma P2002 (duplicate)", async () => {
    const e = new Error("dup") as Error & { code?: string };
    e.code = "P2002";
    evCreate.mockRejectedValue(e);
    const ok = await recordEventIfNew({ id: "evt_dup", type: "checkout.session.completed" as never }, "payload");
    expect(ok).toBe(false);
  });

  it("rethrows other errors", async () => {
    evCreate.mockRejectedValue(new Error("boom"));
    await expect(recordEventIfNew({ id: "evt", type: "checkout.session.completed" as never }, "p")).rejects.toThrow("boom");
  });
});

function checkoutSessionCompletedEvent(overrides: Record<string, unknown> = {}): {
  type: string;
  data: { object: Record<string, unknown> };
} {
  return {
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_123",
        mode: "payment",
        payment_status: "paid",
        amount_total: 100,
        currency: "eur",
        payment_intent: "pi_1",
        customer: "cus_1",
        customer_details: { address: { country: "FR" } },
        total_details: { amount_tax: 0 },
        metadata: { campaign: "beta_founder_1eur" },
        ...overrides,
      },
    },
  };
}

describe("handleCheckoutSessionCompleted", () => {
  it("grants access on a valid event", async () => {
    bfaFindUnique.mockResolvedValue({
      id: "r_1",
      email: "a@b.com",
      status: "pending",
      stripeCheckoutSession: "cs_123",
    });
    bfaUpdate.mockResolvedValue({});
    entFindFirst.mockResolvedValue(null);
    entCreate.mockResolvedValue({ id: "ent_1" });

    const outcome = await handleCheckoutSessionCompleted(
      checkoutSessionCompletedEvent() as never,
      { sendEmail: false },
    );
    expect(outcome).toBe("ok");
    expect(bfaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r_1" },
        data: expect.objectContaining({ status: "paid", userId: "acc_new" }),
      }),
    );
    expect(entCreate).toHaveBeenCalled();
  });

  it("rejects wrong campaign metadata", async () => {
    const ev = checkoutSessionCompletedEvent({ metadata: { campaign: "other" } });
    const outcome = await handleCheckoutSessionCompleted(ev as never);
    expect(outcome).toBe("ignored_wrong_campaign");
    expect(bfaUpdate).not.toHaveBeenCalled();
  });

  it("rejects wrong amount", async () => {
    const ev = checkoutSessionCompletedEvent({ amount_total: 200 });
    const outcome = await handleCheckoutSessionCompleted(ev as never);
    expect(outcome).toBe("ignored_wrong_amount");
  });

  it("rejects wrong currency", async () => {
    const ev = checkoutSessionCompletedEvent({ currency: "usd" });
    const outcome = await handleCheckoutSessionCompleted(ev as never);
    expect(outcome).toBe("ignored_wrong_currency");
  });

  it("rejects unpaid sessions", async () => {
    const ev = checkoutSessionCompletedEvent({ payment_status: "unpaid" });
    const outcome = await handleCheckoutSessionCompleted(ev as never);
    expect(outcome).toBe("ignored_unpaid");
  });

  it("returns no_reservation when no row matches the session id", async () => {
    bfaFindUnique.mockResolvedValue(null);
    const outcome = await handleCheckoutSessionCompleted(
      checkoutSessionCompletedEvent() as never,
    );
    expect(outcome).toBe("no_reservation");
  });

  it("returns already_processed when reservation already paid (re-delivery)", async () => {
    bfaFindUnique.mockResolvedValue({
      id: "r_1",
      email: "a@b.com",
      status: "paid",
      stripeCheckoutSession: "cs_123",
    });
    const outcome = await handleCheckoutSessionCompleted(
      checkoutSessionCompletedEvent() as never,
    );
    expect(outcome).toBe("already_processed");
  });
});

describe("handleCheckoutSessionExpired", () => {
  it("flips matching pending rows to expired", async () => {
    bfaUpdateMany.mockResolvedValue({ count: 1 });
    await handleCheckoutSessionExpired({
      type: "checkout.session.expired",
      data: { object: { id: "cs_x" } },
    } as never);
    expect(bfaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeCheckoutSession: "cs_x", status: "pending" },
        data: { status: "expired" },
      }),
    );
  });
});

describe("handlePaymentIntentFailed", () => {
  it("marks pending row as failed", async () => {
    bfaUpdateMany.mockResolvedValue({ count: 1 });
    await handlePaymentIntentFailed({
      type: "payment_intent.payment_failed",
      data: { object: { id: "pi_1", last_payment_error: { code: "card_declined" } } },
    } as never);
    expect(bfaUpdateMany).toHaveBeenCalled();
  });
});

describe("handleChargeRefunded", () => {
  it("revokes entitlement and flips status to refunded", async () => {
    bfaFindFirst.mockResolvedValue({
      id: "r_1",
      stripePaymentIntent: "pi_1",
      stripeCheckoutSession: "cs_x",
      userId: "acc_1",
    });
    bfaUpdate.mockResolvedValue({});
    entUpdateMany.mockResolvedValue({ count: 1 });
    const outcome = await handleChargeRefunded({
      type: "charge.refunded",
      data: { object: { payment_intent: "pi_1" } },
    } as never);
    expect(outcome).toBe("ok");
    expect(bfaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "refunded" }) }),
    );
    expect(entUpdateMany).toHaveBeenCalled();
  });
});

describe("handleChargeDisputeCreated", () => {
  it("revokes entitlement and flips status to disputed", async () => {
    bfaFindFirst.mockResolvedValue({
      id: "r_1",
      stripePaymentIntent: "pi_1",
      stripeCheckoutSession: "cs_x",
      userId: "acc_1",
    });
    entUpdateMany.mockResolvedValue({ count: 1 });
    const outcome = await handleChargeDisputeCreated({
      type: "charge.dispute.created",
      data: { object: { id: "du_1", payment_intent: "pi_1", reason: "fraudulent" } },
    } as never);
    expect(outcome).toBe("ok");
    expect(bfaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "disputed" }) }),
    );
  });
});

describe("handleChargeDisputeClosed", () => {
  it("does NOT re-activate entitlements", async () => {
    await handleChargeDisputeClosed({
      type: "charge.dispute.closed",
      data: { object: { id: "du_1", status: "lost", reason: "fraudulent" } },
    } as never);
    expect(entCreate).not.toHaveBeenCalled();
    expect(bfaUpdate).not.toHaveBeenCalled();
  });
});
