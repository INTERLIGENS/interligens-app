import { describe, it, expect, beforeEach, vi } from "vitest";

const { accessFindMany, entFindFirst, entCreate, disconnect } = vi.hoisted(() => ({
  accessFindMany: vi.fn(),
  entFindFirst: vi.fn(),
  entCreate: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    investigatorAccess = { findMany: accessFindMany };
    entitlement = { findFirst: entFindFirst, create: entCreate };
    $disconnect = disconnect;
  },
}));

// Import AFTER mock so the script picks up the mocked PrismaClient.
import { run } from "../grandfather-beta-users";

beforeEach(() => {
  accessFindMany.mockReset();
  entFindFirst.mockReset();
  entCreate.mockReset();
  disconnect.mockReset();
  delete process.env.DRY_RUN;
  delete process.env.VERBOSE;
});

describe("grandfather-beta-users", () => {
  it("creates an entitlement for each active access without an existing row", async () => {
    accessFindMany.mockResolvedValue([
      { id: "a1", label: "BA-01" },
      { id: "a2", label: "BA-02" },
    ]);
    entFindFirst.mockResolvedValue(null);
    entCreate.mockResolvedValue({ id: "e" });
    const stats = await run();
    expect(stats.scanned).toBe(2);
    expect(stats.created).toBe(2);
    expect(stats.skipped).toBe(0);
    expect(entCreate).toHaveBeenCalledTimes(2);
  });

  it("skips users that already have a grandfathered entitlement (idempotent)", async () => {
    accessFindMany.mockResolvedValue([{ id: "a1", label: "BA-01" }]);
    entFindFirst.mockResolvedValue({ id: "ent_old" });
    const stats = await run();
    expect(stats.scanned).toBe(1);
    expect(stats.created).toBe(0);
    expect(stats.skipped).toBe(1);
    expect(entCreate).not.toHaveBeenCalled();
  });

  it("counts errors but does not throw", async () => {
    accessFindMany.mockResolvedValue([{ id: "a1", label: "BA-01" }]);
    entFindFirst.mockResolvedValue(null);
    entCreate.mockRejectedValue(new Error("db error"));
    const stats = await run();
    expect(stats.errors).toBe(1);
    expect(stats.created).toBe(0);
  });

  it("in DRY_RUN mode, counts creations but does not call entitlement.create", async () => {
    process.env.DRY_RUN = "true";
    accessFindMany.mockResolvedValue([{ id: "a1", label: "BA-01" }]);
    entFindFirst.mockResolvedValue(null);
    const stats = await run();
    expect(stats.created).toBe(1);
    expect(entCreate).not.toHaveBeenCalled();
  });
});
