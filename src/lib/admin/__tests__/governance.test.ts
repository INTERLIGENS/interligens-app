import { describe, it, expect, vi, beforeEach } from "vitest";

const setGovernedStatus = vi.fn();
const revokeGovernedStatus = vi.fn();
const listGovernedStatus = vi.fn();
const getGovernedStatus = vi.fn();

vi.mock("@/lib/governance/status", () => ({
  setGovernedStatus: (...a: unknown[]) => setGovernedStatus(...a),
  revokeGovernedStatus: (...a: unknown[]) => revokeGovernedStatus(...a),
  listGovernedStatus: (...a: unknown[]) => listGovernedStatus(...a),
  getGovernedStatus: (...a: unknown[]) => getGovernedStatus(...a),
  normaliseEntityValue: (t: string, v: string) =>
    t === "wallet" || t === "token" ? v.toLowerCase() : v,
  ENTITY_TYPES: new Set(["wallet", "token", "domain", "handle"]),
}));

import {
  adminGetGovernedStatus,
  adminListGovernedStatus,
  adminRevokeGovernedStatus,
  adminSetGovernedStatus,
  AdminGovernanceError,
} from "@/lib/admin/governance";

const ACTOR = { userId: "admin:1", role: "admin" };

describe("adminSetGovernedStatus", () => {
  beforeEach(() => {
    setGovernedStatus.mockReset();
  });

  it("rejects unknown entityType", async () => {
    await expect(
      adminSetGovernedStatus(
        {
          entityType: "ufo" as string,
          entityValue: "x",
          status: "watchlisted",
        },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(AdminGovernanceError);
  });

  it("rejects unknown status", async () => {
    await expect(
      adminSetGovernedStatus(
        {
          entityType: "wallet",
          entityValue: "0xabc",
          status: "nonsense",
        },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(AdminGovernanceError);
  });

  it("requires basis for confirmed_known_bad", async () => {
    await expect(
      adminSetGovernedStatus(
        {
          entityType: "wallet",
          entityValue: "0xabc",
          status: "confirmed_known_bad",
        },
        ACTOR,
      ),
    ).rejects.toThrow(/basis/);
  });

  it("rejects blank entityValue", async () => {
    await expect(
      adminSetGovernedStatus(
        {
          entityType: "wallet",
          entityValue: "   ",
          status: "watchlisted",
        },
        ACTOR,
      ),
    ).rejects.toThrow(/entityValue/);
  });

  it("forwards valid inputs to the persistence layer", async () => {
    setGovernedStatus.mockResolvedValue({ id: "x" });
    await adminSetGovernedStatus(
      {
        entityType: "wallet",
        entityValue: "0xabc",
        status: "watchlisted",
      },
      ACTOR,
    );
    expect(setGovernedStatus).toHaveBeenCalledTimes(1);
  });
});

describe("adminRevokeGovernedStatus", () => {
  beforeEach(() => {
    revokeGovernedStatus.mockReset();
    getGovernedStatus.mockReset();
  });

  it("throws NOT_FOUND when no existing row", async () => {
    getGovernedStatus.mockResolvedValue(null);
    await expect(
      adminRevokeGovernedStatus("wallet", "0xabc", "oops", ACTOR),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("requires a non-empty reason", async () => {
    await expect(
      adminRevokeGovernedStatus("wallet", "0xabc", "  ", ACTOR),
    ).rejects.toThrow(/reason/);
  });

  it("calls revoke when the row exists", async () => {
    getGovernedStatus.mockResolvedValue({ id: "x" });
    revokeGovernedStatus.mockResolvedValue({ id: "x", status: "none" });
    await adminRevokeGovernedStatus(
      "wallet",
      "0xabc",
      "fixed",
      ACTOR,
    );
    expect(revokeGovernedStatus).toHaveBeenCalledTimes(1);
  });
});

describe("adminListGovernedStatus", () => {
  it("forwards validated filters to the persistence layer", async () => {
    listGovernedStatus.mockResolvedValue({ total: 0, items: [] });
    await adminListGovernedStatus({
      entityType: "wallet",
      status: "watchlisted",
      reviewState: "reviewed",
    });
    expect(listGovernedStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "wallet",
        status: "watchlisted",
        reviewState: "reviewed",
      }),
    );
  });

  it("rejects invalid filter values", async () => {
    await expect(
      adminListGovernedStatus({ entityType: "plane" }),
    ).rejects.toBeInstanceOf(AdminGovernanceError);
  });
});

describe("adminGetGovernedStatus", () => {
  it("delegates to getGovernedStatus with the validated type", async () => {
    getGovernedStatus.mockResolvedValue(null);
    await adminGetGovernedStatus("token", "abc");
    expect(getGovernedStatus).toHaveBeenCalledWith("token", "abc");
  });
});
