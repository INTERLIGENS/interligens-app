import { describe, it, expect, vi, beforeEach } from "vitest";

const entityGovernedStatusFindUnique = vi.fn();
const entityGovernedStatusUpsert = vi.fn();
const entityGovernedStatusUpdate = vi.fn();
const entityGovernedStatusFindMany = vi.fn();
const entityGovernedStatusCount = vi.fn();
const auditLogCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    entityGovernedStatus: {
      findUnique: (...args: unknown[]) => entityGovernedStatusFindUnique(...args),
      upsert: (...args: unknown[]) => entityGovernedStatusUpsert(...args),
      update: (...args: unknown[]) => entityGovernedStatusUpdate(...args),
      findMany: (...args: unknown[]) => entityGovernedStatusFindMany(...args),
      count: (...args: unknown[]) => entityGovernedStatusCount(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => auditLogCreate(...args),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        entityGovernedStatus: {
          upsert: (...args: unknown[]) => entityGovernedStatusUpsert(...args),
          update: (...args: unknown[]) => entityGovernedStatusUpdate(...args),
        },
        auditLog: { create: (...args: unknown[]) => auditLogCreate(...args) },
      }),
  },
}));

import {
  getGovernedStatus,
  setGovernedStatus,
  revokeGovernedStatus,
  listGovernedStatus,
  normaliseEntityValue,
} from "@/lib/governance/status";

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    entityType: "wallet",
    entityValue: "0xabc",
    chain: "ETH",
    status: "watchlisted",
    basis: null,
    reason: null,
    setByUserId: "admin:123",
    setByUserRole: "admin",
    setAt: new Date("2026-04-17T10:00:00Z"),
    reviewState: "draft",
    evidenceRefs: [],
    revokedAt: null,
    revokedByUserId: null,
    revokedReason: null,
    createdAt: new Date("2026-04-17T10:00:00Z"),
    updatedAt: new Date("2026-04-17T10:00:00Z"),
    ...overrides,
  };
}

describe("normaliseEntityValue", () => {
  it("lowercases wallet and token values", () => {
    expect(normaliseEntityValue("wallet", "0xAbCdEf")).toBe("0xabcdef");
    expect(normaliseEntityValue("token", "USDC")).toBe("usdc");
  });
  it("keeps handles / domains case-sensitive", () => {
    expect(normaliseEntityValue("handle", "ZachXBT")).toBe("ZachXBT");
    expect(normaliseEntityValue("domain", "Gotbit.IO")).toBe("Gotbit.IO");
  });
});

describe("getGovernedStatus", () => {
  beforeEach(() => {
    entityGovernedStatusFindUnique.mockReset();
  });

  it("returns null when nothing exists", async () => {
    entityGovernedStatusFindUnique.mockResolvedValue(null);
    const r = await getGovernedStatus("wallet", "0xabc");
    expect(r).toBeNull();
  });

  it("returns the shaped record when a row exists", async () => {
    entityGovernedStatusFindUnique.mockResolvedValue(baseRow());
    const r = await getGovernedStatus("wallet", "0xABC"); // lowercases internally
    expect(r?.status).toBe("watchlisted");
    const args = entityGovernedStatusFindUnique.mock.calls[0][0];
    expect(args.where.entityType_entityValue.entityValue).toBe("0xabc");
  });

  it("throws on invalid entityType", async () => {
    await expect(
      // @ts-expect-error — defensive check
      getGovernedStatus("invalid", "value"),
    ).rejects.toThrow(/invalid entityType/);
  });
});

describe("setGovernedStatus", () => {
  beforeEach(() => {
    entityGovernedStatusUpsert.mockReset();
    auditLogCreate.mockReset();
    auditLogCreate.mockResolvedValue({});
  });

  it("rejects confirmed_known_bad without a basis", async () => {
    await expect(
      setGovernedStatus(
        {
          entityType: "wallet",
          entityValue: "0xabc",
          status: "confirmed_known_bad",
        },
        { userId: "admin:1", role: "admin" },
      ),
    ).rejects.toThrow(/basis/);
  });

  it("rejects authority_flagged without a basis", async () => {
    await expect(
      setGovernedStatus(
        {
          entityType: "wallet",
          entityValue: "0xabc",
          status: "authority_flagged",
        },
        { userId: "admin:1", role: "admin" },
      ),
    ).rejects.toThrow(/basis/);
  });

  it("upserts and writes an audit log for valid status changes", async () => {
    entityGovernedStatusUpsert.mockResolvedValue(
      baseRow({ status: "watchlisted" }),
    );
    const r = await setGovernedStatus(
      {
        entityType: "wallet",
        entityValue: "0xABC",
        chain: "ETH",
        status: "watchlisted",
        reason: "under watch",
      },
      { userId: "admin:1" },
    );
    expect(r.status).toBe("watchlisted");
    expect(entityGovernedStatusUpsert).toHaveBeenCalledTimes(1);
    expect(auditLogCreate).toHaveBeenCalledTimes(1);
    const audit = auditLogCreate.mock.calls[0][0].data;
    expect(audit.action).toBe("governance.status.set");
    expect(audit.actorId).toBe("admin:1");
  });

  it("lowercases the entityValue for wallet/token upserts", async () => {
    entityGovernedStatusUpsert.mockResolvedValue(baseRow());
    await setGovernedStatus(
      {
        entityType: "wallet",
        entityValue: "0xABC",
        status: "watchlisted",
      },
      { userId: "admin:1" },
    );
    const where = entityGovernedStatusUpsert.mock.calls[0][0].where;
    expect(where.entityType_entityValue.entityValue).toBe("0xabc");
  });

  it("accepts confirmed_known_bad when basis is provided", async () => {
    entityGovernedStatusUpsert.mockResolvedValue(
      baseRow({
        status: "confirmed_known_bad",
        basis: "manual_internal_confirmation",
      }),
    );
    const r = await setGovernedStatus(
      {
        entityType: "wallet",
        entityValue: "0xabc",
        status: "confirmed_known_bad",
        basis: "manual_internal_confirmation",
        reason: "confirmed via case INV-7",
      },
      { userId: "admin:1" },
    );
    expect(r.basis).toBe("manual_internal_confirmation");
  });
});

describe("revokeGovernedStatus", () => {
  beforeEach(() => {
    entityGovernedStatusUpdate.mockReset();
    auditLogCreate.mockReset();
    auditLogCreate.mockResolvedValue({});
  });

  it("requires a reason", async () => {
    await expect(
      revokeGovernedStatus(
        { entityType: "wallet", entityValue: "0xabc", reason: "   " },
        { userId: "admin:1" },
      ),
    ).rejects.toThrow(/reason/);
  });

  it("sets status=none, stamps revokedAt/By, logs audit", async () => {
    entityGovernedStatusUpdate.mockResolvedValue(
      baseRow({
        status: "none",
        revokedAt: new Date(),
        revokedByUserId: "admin:1",
        revokedReason: "fixed after review",
      }),
    );
    const r = await revokeGovernedStatus(
      { entityType: "wallet", entityValue: "0xabc", reason: "fixed after review" },
      { userId: "admin:1" },
    );
    expect(r.status).toBe("none");
    expect(r.revokedAt).not.toBeNull();
    expect(auditLogCreate).toHaveBeenCalled();
  });
});

describe("listGovernedStatus", () => {
  beforeEach(() => {
    entityGovernedStatusCount.mockReset();
    entityGovernedStatusFindMany.mockReset();
    entityGovernedStatusCount.mockResolvedValue(0);
    entityGovernedStatusFindMany.mockResolvedValue([]);
  });

  it("excludes revoked by default", async () => {
    await listGovernedStatus({});
    const where = entityGovernedStatusFindMany.mock.calls[0][0].where;
    expect(where.revokedAt).toBe(null);
  });

  it("includes revoked when includeRevoked=true", async () => {
    await listGovernedStatus({ includeRevoked: true });
    const where = entityGovernedStatusFindMany.mock.calls[0][0].where;
    expect("revokedAt" in where).toBe(false);
  });

  it("respects the limit cap of 200", async () => {
    await listGovernedStatus({ limit: 9999 });
    const take = entityGovernedStatusFindMany.mock.calls[0][0].take;
    expect(take).toBe(200);
  });
});
