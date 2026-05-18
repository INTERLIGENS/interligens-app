import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    entitlement: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { grantEntitlement, revokeEntitlementsBySource, hasActiveBetaEntitlement } from "../entitlement";

const findFirst = prisma.entitlement.findFirst as unknown as ReturnType<typeof vi.fn>;
const create = prisma.entitlement.create as unknown as ReturnType<typeof vi.fn>;
const updateMany = prisma.entitlement.updateMany as unknown as ReturnType<typeof vi.fn>;

describe("grantEntitlement", () => {
  beforeEach(() => {
    findFirst.mockReset();
    create.mockReset();
    updateMany.mockReset();
  });

  it("returns the existing entitlement without creating", async () => {
    findFirst.mockResolvedValue({ id: "ent_1" });
    const res = await grantEntitlement({
      userId: "u",
      type: "beta_founder_access",
      source: "stripe_checkout",
      sourceId: "cs_123",
    });
    expect(res).toEqual({ id: "ent_1", created: false });
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a new entitlement when none active exists", async () => {
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({ id: "ent_new" });
    const res = await grantEntitlement({
      userId: "u",
      type: "beta_founder_access",
      source: "stripe_checkout",
      sourceId: "cs_123",
    });
    expect(res).toEqual({ id: "ent_new", created: true });
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("revokeEntitlementsBySource", () => {
  beforeEach(() => updateMany.mockReset());

  it("updates active entitlements to revoked and returns count", async () => {
    updateMany.mockResolvedValue({ count: 2 });
    const res = await revokeEntitlementsBySource({
      source: "stripe_checkout",
      sourceId: "cs_123",
      reason: "refund",
    });
    expect(res).toEqual({ revokedCount: 2 });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ source: "stripe_checkout", sourceId: "cs_123" }),
        data: expect.objectContaining({ status: "revoked", revokeReason: "refund" }),
      }),
    );
  });
});

describe("hasActiveBetaEntitlement", () => {
  beforeEach(() => findFirst.mockReset());

  it("returns true when active entitlement found", async () => {
    findFirst.mockResolvedValue({ id: "x" });
    expect(await hasActiveBetaEntitlement("u")).toBe(true);
  });

  it("returns false when none", async () => {
    findFirst.mockResolvedValue(null);
    expect(await hasActiveBetaEntitlement("u")).toBe(false);
  });
});
