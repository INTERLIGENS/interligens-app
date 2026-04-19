import { describe, it, expect, vi, beforeEach } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

const mmReviewLogFindMany = vi.fn<AnyFn>();
const mmReviewLogCount = vi.fn<AnyFn>();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    mmReviewLog: {
      findMany: (arg: unknown) => mmReviewLogFindMany(arg),
      count: (arg: unknown) => mmReviewLogCount(arg),
    },
  },
}));

import {
  countPendingAlerts,
  getPendingAlerts,
} from "@/lib/mm/integration/alertManager";

beforeEach(() => {
  mmReviewLogFindMany.mockReset();
  mmReviewLogCount.mockReset();
});

function row(
  overrides: Record<string, unknown> = {},
  snapshot: Record<string, unknown> = {},
) {
  return {
    id: `log-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date("2026-04-17T10:00:00Z"),
    snapshotAfter: {
      tokenAddress: "0xT",
      chain: "ETHEREUM",
      kolHandle: "kol",
      displayScore: 85,
      band: "RED",
      tweetUrl: null,
      detectedAt: "2026-04-17T10:00:00Z",
      ...snapshot,
    },
    ...overrides,
  };
}

describe("getPendingAlerts", () => {
  it("returns alerts shaped from review-log snapshotAfter", async () => {
    mmReviewLogFindMany.mockResolvedValue([row(), row()]);
    const r = await getPendingAlerts();
    expect(r).toHaveLength(2);
    expect(r[0].tokenAddress).toBe("0xT");
    expect(r[0].band).toBe("RED");
    expect(r[0].kolHandle).toBe("kol");
  });

  it("filters by minBand=RED", async () => {
    mmReviewLogFindMany.mockResolvedValue([
      row({}, { band: "ORANGE", displayScore: 55 }),
      row({}, { band: "RED", displayScore: 90 }),
    ]);
    const r = await getPendingAlerts({ minBand: "RED" });
    expect(r).toHaveLength(1);
    expect(r[0].band).toBe("RED");
  });

  it("accepts a `since` filter and forwards to Prisma where clause", async () => {
    mmReviewLogFindMany.mockResolvedValue([]);
    const since = new Date("2026-04-17T00:00:00Z");
    await getPendingAlerts({ since });
    const call = mmReviewLogFindMany.mock.calls[0][0] as {
      where: { createdAt?: { gt?: Date } };
    };
    expect(call.where.createdAt?.gt?.toISOString()).toBe(since.toISOString());
  });

  it("clamps limit into [1, 500]", async () => {
    mmReviewLogFindMany.mockResolvedValue([]);
    await getPendingAlerts({ limit: 10_000 });
    expect(
      (mmReviewLogFindMany.mock.calls[0][0] as { take: number }).take,
    ).toBe(500);
    mmReviewLogFindMany.mockClear();
    await getPendingAlerts({ limit: 0 });
    expect(
      (mmReviewLogFindMany.mock.calls[0][0] as { take: number }).take,
    ).toBe(1);
  });
});

describe("countPendingAlerts", () => {
  it("counts rows via the same where clause", async () => {
    mmReviewLogCount.mockResolvedValue(3);
    const n = await countPendingAlerts(new Date("2026-04-17T00:00:00Z"));
    expect(n).toBe(3);
    const call = mmReviewLogCount.mock.calls[0][0] as {
      where: { actorRole: string; action: string };
    };
    expect(call.where.actorRole).toBe("watcher_mm_alert");
    expect(call.where.action).toBe("CREATED");
  });
});
