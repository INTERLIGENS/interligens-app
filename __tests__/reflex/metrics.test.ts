import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reflexAnalysis: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import {
  computeAlerts,
  computeStopRate,
  countAnalyses,
  dailyStopRate,
  inputTypeDistribution,
  lastN,
  latencyStats,
  modeBreakdown,
  parseWindow,
  topHandles,
  topNarrativeScripts,
  verdictDistribution,
  windowStartDate,
} from "@/lib/reflex/metrics";

const mockCount = vi.mocked(
  prisma.reflexAnalysis.count as unknown as (...a: unknown[]) => unknown,
);
const mockGroupBy = vi.mocked(
  prisma.reflexAnalysis.groupBy as unknown as (...a: unknown[]) => unknown,
);
const mockFindMany = vi.mocked(
  prisma.reflexAnalysis.findMany as unknown as (...a: unknown[]) => unknown,
);
const mockQueryRaw = vi.mocked(
  prisma.$queryRaw as unknown as (...a: unknown[]) => unknown,
);

beforeEach(() => {
  vi.clearAllMocks();
});

const ALERT_COPY = {
  overfiring: "REFLEX may be overfiring",
  underfiring: "REFLEX may be underfiring",
  slow: "Performance degradation",
};

// ─── parseWindow + windowStartDate ────────────────────────────────────────

describe("parseWindow", () => {
  it.each([
    ["24h", "24h"], ["7d", "7d"], ["30d", "30d"],
    [undefined, "30d"], ["invalid", "30d"], ["", "30d"],
  ])("parses %s → %s", (input, expected) => {
    expect(parseWindow(input)).toBe(expected);
  });
});

describe("windowStartDate", () => {
  it("24h is ~24h ago", () => {
    const d = windowStartDate("24h");
    const diff = Date.now() - d.getTime();
    expect(diff).toBeGreaterThanOrEqual(86_399_000);
    expect(diff).toBeLessThanOrEqual(86_401_000);
  });
  it("30d is ~30d ago", () => {
    const d = windowStartDate("30d");
    const diff = Date.now() - d.getTime();
    expect(diff).toBeGreaterThanOrEqual(30 * 86_400_000 - 1000);
  });
});

// ─── verdictDistribution ──────────────────────────────────────────────────

describe("verdictDistribution", () => {
  it("returns base zeros when DB empty", async () => {
    mockGroupBy.mockResolvedValue([]);
    const r = await verdictDistribution(new Date(0));
    expect(r).toEqual({ STOP: 0, WAIT: 0, VERIFY: 0, NO_CRITICAL_SIGNAL: 0 });
  });

  it("aggregates groupBy rows correctly", async () => {
    mockGroupBy.mockResolvedValue([
      { verdict: "STOP", _count: { _all: 10 } },
      { verdict: "WAIT", _count: { _all: 25 } },
      { verdict: "NO_CRITICAL_SIGNAL", _count: { _all: 60 } },
    ]);
    const r = await verdictDistribution(new Date(0));
    expect(r).toEqual({ STOP: 10, WAIT: 25, VERIFY: 0, NO_CRITICAL_SIGNAL: 60 });
  });
});

// ─── inputTypeDistribution + modeBreakdown ────────────────────────────────

describe("inputTypeDistribution", () => {
  it("aggregates types", async () => {
    mockGroupBy.mockResolvedValue([
      { inputType: "EVM_TOKEN", _count: { _all: 30 } },
      { inputType: "X_HANDLE", _count: { _all: 12 } },
    ]);
    const r = await inputTypeDistribution(new Date(0));
    expect(r).toEqual({ EVM_TOKEN: 30, X_HANDLE: 12 });
  });
});

describe("modeBreakdown", () => {
  it("aggregates modes", async () => {
    mockGroupBy.mockResolvedValue([
      { mode: "SHADOW", _count: { _all: 100 } },
      { mode: "PUBLIC", _count: { _all: 5 } },
    ]);
    const r = await modeBreakdown(new Date(0));
    expect(r).toEqual({ SHADOW: 100, PUBLIC: 5 });
  });
});

// ─── latencyStats ─────────────────────────────────────────────────────────

describe("latencyStats", () => {
  it("returns zeros when empty", async () => {
    mockFindMany.mockResolvedValue([]);
    const r = await latencyStats(new Date(0));
    expect(r).toEqual({ count: 0, p50: 0, p95: 0, p99: 0 });
  });

  it("computes percentiles on a 100-sample distribution", async () => {
    const samples = Array.from({ length: 100 }, (_, i) => ({ latencyMs: i + 1 }));
    mockFindMany.mockResolvedValue(samples);
    const r = await latencyStats(new Date(0));
    expect(r.count).toBe(100);
    expect(r.p50).toBe(50);
    expect(r.p95).toBe(95);
    expect(r.p99).toBe(99);
  });
});

// ─── dailyStopRate ────────────────────────────────────────────────────────

describe("dailyStopRate", () => {
  it("returns [] when no rows", async () => {
    mockQueryRaw.mockResolvedValue([]);
    expect(await dailyStopRate(new Date(0))).toEqual([]);
  });

  it("converts bigint totals + computes rate per day", async () => {
    mockQueryRaw.mockResolvedValue([
      { day: new Date("2026-05-10T00:00:00Z"), total: 10n, stops: 2n },
      { day: new Date("2026-05-11T00:00:00Z"), total: 20n, stops: 8n },
    ]);
    const r = await dailyStopRate(new Date(0));
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ day: "2026-05-10", total: 10, stops: 2, rate: 0.2 });
    expect(r[1]).toEqual({ day: "2026-05-11", total: 20, stops: 8, rate: 0.4 });
  });
});

// ─── topNarrativeScripts ──────────────────────────────────────────────────

describe("topNarrativeScripts", () => {
  it("counts narrative.* codes across manifests, sorted desc", async () => {
    mockFindMany.mockResolvedValue([
      {
        signalsManifest: {
          engines: [
            {
              engine: "narrative",
              signals: [
                { code: "narrative.FAKE_AUDIT" },
                { code: "narrative.FAKE_PARTNERSHIP" },
              ],
            },
            { engine: "knownBad", signals: [] },
          ],
        },
      },
      {
        signalsManifest: {
          engines: [
            {
              engine: "narrative",
              signals: [{ code: "narrative.FAKE_AUDIT" }],
            },
          ],
        },
      },
      {
        signalsManifest: { engines: [] },
      },
    ]);
    const r = await topNarrativeScripts(new Date(0), 10);
    expect(r).toEqual([
      { code: "narrative.FAKE_AUDIT", count: 2 },
      { code: "narrative.FAKE_PARTNERSHIP", count: 1 },
    ]);
  });

  it("ignores non-narrative codes", async () => {
    mockFindMany.mockResolvedValue([
      {
        signalsManifest: {
          engines: [
            { engine: "narrative", signals: [{ code: "knownBad.scam.eth" }] },
          ],
        },
      },
    ]);
    expect(await topNarrativeScripts(new Date(0), 10)).toEqual([]);
  });

  it("respects the limit", async () => {
    const engines = Array.from({ length: 20 }, (_, i) => ({
      engine: "narrative",
      signals: [{ code: `narrative.SCRIPT_${i}` }],
    }));
    mockFindMany.mockResolvedValue([{ signalsManifest: { engines } }]);
    const r = await topNarrativeScripts(new Date(0), 5);
    expect(r).toHaveLength(5);
  });
});

// ─── topHandles ──────────────────────────────────────────────────────────

describe("topHandles", () => {
  it("returns handles with counts", async () => {
    mockGroupBy.mockResolvedValue([
      { inputResolvedHandle: "donwedge", _count: { _all: 7 } },
      { inputResolvedHandle: "gordongekko", _count: { _all: 3 } },
    ]);
    const r = await topHandles(new Date(0), 10);
    expect(r).toEqual([
      { handle: "donwedge", count: 7 },
      { handle: "gordongekko", count: 3 },
    ]);
  });

  it("filters out null handles", async () => {
    mockGroupBy.mockResolvedValue([
      { inputResolvedHandle: "donwedge", _count: { _all: 5 } },
      { inputResolvedHandle: null, _count: { _all: 10 } },
    ]);
    const r = await topHandles(new Date(0), 10);
    expect(r).toEqual([{ handle: "donwedge", count: 5 }]);
  });
});

// ─── lastN ───────────────────────────────────────────────────────────────

describe("lastN", () => {
  it("delegates to findMany with take=N orderBy createdAt desc", async () => {
    mockFindMany.mockResolvedValue([]);
    await lastN(50);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
  });
});

// ─── countAnalyses ───────────────────────────────────────────────────────

describe("countAnalyses", () => {
  it("calls prisma.count with createdAt gte filter", async () => {
    mockCount.mockResolvedValue(42);
    const since = new Date("2026-05-01");
    const r = await countAnalyses(since);
    expect(r).toBe(42);
    expect(mockCount).toHaveBeenCalledWith({
      where: { createdAt: { gte: since } },
    });
  });
});

// ─── pure helpers ────────────────────────────────────────────────────────

describe("computeStopRate", () => {
  it("zero when no analyses", () => {
    expect(computeStopRate({ STOP: 0, WAIT: 0, VERIFY: 0, NO_CRITICAL_SIGNAL: 0 })).toBe(0);
  });
  it("STOP / total", () => {
    expect(computeStopRate({ STOP: 25, WAIT: 25, VERIFY: 25, NO_CRITICAL_SIGNAL: 25 })).toBe(0.25);
  });
});

describe("computeAlerts", () => {
  it("no alerts when sample size < 20", () => {
    expect(computeAlerts(0.9, 5, 1000, ALERT_COPY)).toEqual([]);
  });
  it("overfiring when STOP rate > 30%", () => {
    const alerts = computeAlerts(0.35, 100, 1000, ALERT_COPY);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe("red");
    expect(alerts[0].message).toBe(ALERT_COPY.overfiring);
  });
  it("underfiring when STOP rate < 5%", () => {
    const alerts = computeAlerts(0.02, 100, 1000, ALERT_COPY);
    expect(alerts[0].level).toBe("orange");
    expect(alerts[0].message).toBe(ALERT_COPY.underfiring);
  });
  it("slow when p95 > 5000", () => {
    const alerts = computeAlerts(0.15, 100, 5500, ALERT_COPY);
    expect(alerts.some((a) => a.message === ALERT_COPY.slow)).toBe(true);
  });
  it("can emit two alerts (overfiring + slow)", () => {
    const alerts = computeAlerts(0.4, 100, 6000, ALERT_COPY);
    expect(alerts).toHaveLength(2);
  });
  it("no alert in healthy window", () => {
    const alerts = computeAlerts(0.15, 100, 2000, ALERT_COPY);
    expect(alerts).toEqual([]);
  });
});
