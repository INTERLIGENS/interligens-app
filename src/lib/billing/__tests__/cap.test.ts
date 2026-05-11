import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { checkCap } from "../cap";

const $queryRawMock = prisma.$queryRaw as unknown as ReturnType<typeof vi.fn>;

const ORIG_OVERRIDE = process.env.BETA_CAP_REACHED;
const ORIG_CAP = process.env.BETA_FOUNDER_CAP;

describe("checkCap", () => {
  beforeEach(() => {
    $queryRawMock.mockReset();
    process.env.BETA_CAP_REACHED = "false";
    process.env.BETA_FOUNDER_CAP = "10";
  });

  afterEach(() => {
    process.env.BETA_CAP_REACHED = ORIG_OVERRIDE;
    process.env.BETA_FOUNDER_CAP = ORIG_CAP;
  });

  it("denies when override flag is set, regardless of count", async () => {
    process.env.BETA_CAP_REACHED = "true";
    const res = await checkCap();
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toBe("override");
  });

  it("denies when count >= cap", async () => {
    $queryRawMock.mockResolvedValueOnce([{ count: BigInt(10) }]);
    const res = await checkCap();
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toBe("sold_out");
  });

  it("allows when count < cap", async () => {
    $queryRawMock.mockResolvedValueOnce([{ count: BigInt(3) }]);
    const res = await checkCap();
    expect(res.allowed).toBe(true);
    if (res.allowed) expect(res.currentCount).toBe(3);
  });

  it("uses tx.$queryRaw when provided", async () => {
    const txMock = { $queryRaw: vi.fn().mockResolvedValueOnce([{ count: BigInt(1) }]) };
    const res = await checkCap({ tx: txMock as unknown as Pick<typeof prisma, "$queryRaw"> });
    expect(res.allowed).toBe(true);
    expect(txMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect($queryRawMock).not.toHaveBeenCalled();
  });
});
