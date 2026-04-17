import { describe, it, expect, vi, beforeEach } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

const mmScoreFindUnique = vi.fn<AnyFn>();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    mmScore: {
      findUnique: (arg: unknown) => mmScoreFindUnique(arg),
    },
    mmReviewLog: {
      create: vi.fn(async () => ({})),
    },
  },
}));

const scanToken = vi.fn<AnyFn>();
vi.mock("@/lib/mm/data/scanner", () => ({
  scanToken: (...args: unknown[]) => scanToken(...args),
  scanWallet: vi.fn(),
}));

const writeReviewLog = vi.fn<AnyFn>(async () => ({}));
vi.mock("@/lib/mm/registry/reviewLog", () => ({
  writeReviewLog: (arg: unknown) => writeReviewLog(arg),
}));

import { onKolShillDetected } from "@/lib/mm/integration/watcherHook";

const NOW = new Date("2026-04-17T12:00:00.000Z").getTime();
const CACHED_AT_FRESH = new Date(NOW - 1 * 60 * 60 * 1_000); // 1h ago

beforeEach(() => {
  mmScoreFindUnique.mockReset();
  scanToken.mockReset();
  writeReviewLog.mockClear();
});

describe("onKolShillDetected", () => {
  it("returns cache hit when MmScore is fresh", async () => {
    mmScoreFindUnique.mockResolvedValue({
      scanRunId: "run-cache-1",
      displayScore: 85,
      band: "RED",
      computedAt: CACHED_AT_FRESH,
    });
    const r = await onKolShillDetected(
      {
        kolHandle: "kol",
        tokenAddress: "0xTOKEN",
        chain: "ETHEREUM",
        detectedAt: new Date(NOW),
      },
      { nowMs: NOW },
    );
    expect(r.ok).toBe(true);
    expect(r.source).toBe("cache");
    expect(r.displayScore).toBe(85);
    expect(r.alert).toBe(true);
    expect(r.alertLevel).toBe("RED");
    expect(scanToken).not.toHaveBeenCalled();
  });

  it("falls through to a fresh scan when cache is stale", async () => {
    mmScoreFindUnique.mockResolvedValueOnce({
      scanRunId: "run-old",
      displayScore: 85,
      band: "RED",
      computedAt: new Date(NOW - 24 * 60 * 60 * 1_000), // 24h ago
    });
    scanToken.mockResolvedValue({ behaviorDrivenScore: 42 });
    mmScoreFindUnique.mockResolvedValueOnce({
      scanRunId: "run-fresh",
      displayScore: 42,
      band: "ORANGE",
      computedAt: new Date(NOW),
    });
    const r = await onKolShillDetected(
      {
        kolHandle: "kol",
        tokenAddress: "0xTOKEN",
        chain: "ETHEREUM",
        detectedAt: new Date(NOW),
      },
      { nowMs: NOW },
    );
    expect(r.source).toBe("compute");
    expect(scanToken).toHaveBeenCalledTimes(1);
    expect(r.displayScore).toBe(42);
    expect(r.alertLevel).toBe("ORANGE");
  });

  it("emits an alert for ORANGE / RED", async () => {
    mmScoreFindUnique.mockResolvedValue({
      scanRunId: "run-1",
      displayScore: 55,
      band: "ORANGE",
      computedAt: CACHED_AT_FRESH,
    });
    const r = await onKolShillDetected(
      {
        kolHandle: "kol",
        tokenAddress: "0xTOKEN",
        chain: "ETHEREUM",
        detectedAt: new Date(NOW),
      },
      { nowMs: NOW },
    );
    expect(r.alert).toBe(true);
    expect(r.alertLevel).toBe("ORANGE");
    expect(writeReviewLog).toHaveBeenCalledTimes(1);
    const logArg = writeReviewLog.mock.calls[0][0] as {
      actorRole: string;
      targetType: string;
    };
    expect(logArg.actorRole).toBe("watcher_mm_alert");
    expect(logArg.targetType).toBe("SCAN_RUN");
  });

  it("does NOT emit an alert for GREEN / YELLOW", async () => {
    mmScoreFindUnique.mockResolvedValue({
      scanRunId: "run-1",
      displayScore: 25,
      band: "YELLOW",
      computedAt: CACHED_AT_FRESH,
    });
    const r = await onKolShillDetected(
      {
        kolHandle: "kol",
        tokenAddress: "0xTOKEN",
        chain: "ETHEREUM",
        detectedAt: new Date(NOW),
      },
      { nowMs: NOW },
    );
    expect(r.alert).toBe(false);
    expect(r.alertLevel).toBeUndefined();
    expect(writeReviewLog).not.toHaveBeenCalled();
  });

  it("returns a graceful error when cache lookup throws", async () => {
    mmScoreFindUnique.mockRejectedValue(new Error("db boom"));
    const r = await onKolShillDetected(
      {
        kolHandle: "kol",
        tokenAddress: "0xTOKEN",
        chain: "ETHEREUM",
        detectedAt: new Date(NOW),
      },
      { nowMs: NOW },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toBe(true);
    expect(r.reason).toMatch(/cache_lookup_failed/);
  });

  it("returns a graceful error when scanToken throws", async () => {
    mmScoreFindUnique.mockResolvedValueOnce(null);
    scanToken.mockRejectedValue(new Error("birdeye 500"));
    const r = await onKolShillDetected(
      {
        kolHandle: "kol",
        tokenAddress: "0xTOKEN",
        chain: "ETHEREUM",
        detectedAt: new Date(NOW),
      },
      { nowMs: NOW },
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/scan_failed/);
  });
});
