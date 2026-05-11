import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSearch, mockCreate } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    billingCustomer: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("../stripeClient", () => ({
  getStripe: () => ({
    customers: {
      search: mockSearch,
      create: mockCreate,
    },
  }),
}));

import { prisma } from "@/lib/prisma";
import { lookupOrCreateStripeCustomer } from "../customerLookup";

const findUnique = prisma.billingCustomer.findUnique as unknown as ReturnType<typeof vi.fn>;
const findFirst = prisma.billingCustomer.findFirst as unknown as ReturnType<typeof vi.fn>;
const upsert = prisma.billingCustomer.upsert as unknown as ReturnType<typeof vi.fn>;

describe("lookupOrCreateStripeCustomer", () => {
  beforeEach(() => {
    findUnique.mockReset();
    findFirst.mockReset();
    upsert.mockReset();
    mockSearch.mockReset();
    mockCreate.mockReset();
  });

  it("returns existing BillingCustomer by userId without calling Stripe", async () => {
    findUnique.mockResolvedValue({ stripeCustomerId: "cus_existing", email: "a@b.com" });
    const res = await lookupOrCreateStripeCustomer({ userId: "u_1", email: "A@B.com" });
    expect(res).toEqual({ stripeCustomerId: "cus_existing", created: false });
    expect(mockSearch).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("falls back to email lookup when no userId match", async () => {
    findUnique.mockResolvedValue(null);
    findFirst.mockResolvedValue({ stripeCustomerId: "cus_byemail", email: "a@b.com" });
    const res = await lookupOrCreateStripeCustomer({ userId: "u_1", email: "a@b.com" });
    expect(res.stripeCustomerId).toBe("cus_byemail");
    expect(res.created).toBe(false);
  });

  it("uses Stripe search when DB has nothing", async () => {
    findUnique.mockResolvedValue(null);
    findFirst.mockResolvedValue(null);
    mockSearch.mockResolvedValue({ data: [{ id: "cus_stripe" }] });
    const res = await lookupOrCreateStripeCustomer({ userId: "u_1", email: "a@b.com" });
    expect(res.stripeCustomerId).toBe("cus_stripe");
    expect(res.created).toBe(false);
    expect(upsert).toHaveBeenCalled();
  });

  it("creates a new Stripe Customer as last resort", async () => {
    findUnique.mockResolvedValue(null);
    findFirst.mockResolvedValue(null);
    mockSearch.mockResolvedValue({ data: [] });
    mockCreate.mockResolvedValue({ id: "cus_new" });
    const res = await lookupOrCreateStripeCustomer({ userId: "u_1", email: "a@b.com" });
    expect(res).toEqual({ stripeCustomerId: "cus_new", created: true });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@b.com", metadata: expect.objectContaining({ userId: "u_1" }) }),
    );
  });

  it("does not write BillingCustomer when userId is null (pre-payment)", async () => {
    findUnique.mockResolvedValue(null);
    findFirst.mockResolvedValue(null);
    mockSearch.mockResolvedValue({ data: [] });
    mockCreate.mockResolvedValue({ id: "cus_anon" });
    await lookupOrCreateStripeCustomer({ userId: null, email: "anon@b.com" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("never creates a second Customer when userId already mapped (retry-safe)", async () => {
    findUnique.mockResolvedValue({ stripeCustomerId: "cus_existing", email: "a@b.com" });
    await lookupOrCreateStripeCustomer({ userId: "u_1", email: "a@b.com" });
    await lookupOrCreateStripeCustomer({ userId: "u_1", email: "a@b.com" });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
