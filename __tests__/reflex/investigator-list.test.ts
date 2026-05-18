import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reflexAnalysis: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  buildFilterQuery,
  buildWhere,
  DEFAULT_FILTERS,
  listAnalyses,
  parseFilters,
  type ListFilters,
} from "@/lib/reflex/investigator-list";

const mockFindMany = vi.mocked(
  prisma.reflexAnalysis.findMany as unknown as (...a: unknown[]) => unknown,
);
const mockCount = vi.mocked(
  prisma.reflexAnalysis.count as unknown as (...a: unknown[]) => unknown,
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parseFilters — defaults", () => {
  it("empty search params → DEFAULT_FILTERS", () => {
    expect(parseFilters({})).toEqual(DEFAULT_FILTERS);
  });

  it("respects all valid params", () => {
    const r = parseFilters({
      verdict: "STOP", mode: "SHADOW", window: "7d", fp: "FLAGGED", page: "3",
    });
    expect(r).toEqual({
      verdict: "STOP", mode: "SHADOW", window: "7d", fp: "FLAGGED",
      page: 3, perPage: 50,
    });
  });

  it("rejects invalid enum values, falls back to default", () => {
    const r = parseFilters({
      verdict: "INVALID", mode: "wrong", window: "garbage", fp: "nope",
    });
    expect(r.verdict).toBe(DEFAULT_FILTERS.verdict);
    expect(r.mode).toBe(DEFAULT_FILTERS.mode);
    expect(r.window).toBe(DEFAULT_FILTERS.window);
    expect(r.fp).toBe(DEFAULT_FILTERS.fp);
  });

  it("clamps page to [1, 10000]", () => {
    expect(parseFilters({ page: "0" }).page).toBe(1);
    expect(parseFilters({ page: "-5" }).page).toBe(1);
    expect(parseFilters({ page: "999999" }).page).toBe(10_000);
  });

  it("clamps perPage to [1, 200]", () => {
    expect(parseFilters({ perPage: "0" }).perPage).toBe(1);
    expect(parseFilters({ perPage: "500" }).perPage).toBe(200);
  });

  it("non-numeric page → default 1", () => {
    expect(parseFilters({ page: "abc" }).page).toBe(1);
  });

  it("array values take the first element", () => {
    const r = parseFilters({ verdict: ["WAIT", "STOP"] });
    expect(r.verdict).toBe("WAIT");
  });
});

describe("buildWhere", () => {
  it("ALL filters → empty where", () => {
    expect(buildWhere({ ...DEFAULT_FILTERS, window: "ALL" })).toEqual({});
  });

  it("verdict filter present", () => {
    const w = buildWhere({ ...DEFAULT_FILTERS, verdict: "STOP", window: "ALL" });
    expect(w.verdict).toBe("STOP");
  });

  it("mode filter present", () => {
    const w = buildWhere({ ...DEFAULT_FILTERS, mode: "PUBLIC", window: "ALL" });
    expect(w.mode).toBe("PUBLIC");
  });

  it("window 24h adds createdAt gte ~24h ago", () => {
    const t0 = Date.now();
    const w = buildWhere({ ...DEFAULT_FILTERS, window: "24h" });
    expect(w.createdAt?.gte).toBeInstanceOf(Date);
    const diff = t0 - (w.createdAt!.gte as Date).getTime();
    expect(diff).toBeGreaterThanOrEqual(86_399_000);
    expect(diff).toBeLessThanOrEqual(86_401_000);
  });

  it("fp FLAGGED → falsePositiveFlag true", () => {
    const w = buildWhere({ ...DEFAULT_FILTERS, fp: "FLAGGED", window: "ALL" });
    expect(w.falsePositiveFlag).toBe(true);
  });

  it("fp UNFLAGGED → falsePositiveFlag false", () => {
    const w = buildWhere({ ...DEFAULT_FILTERS, fp: "UNFLAGGED", window: "ALL" });
    expect(w.falsePositiveFlag).toBe(false);
  });

  it("combines all filters", () => {
    const w = buildWhere({
      verdict: "WAIT", mode: "SHADOW", window: "7d", fp: "FLAGGED",
      page: 1, perPage: 50,
    });
    expect(w.verdict).toBe("WAIT");
    expect(w.mode).toBe("SHADOW");
    expect(w.falsePositiveFlag).toBe(true);
    expect(w.createdAt?.gte).toBeInstanceOf(Date);
  });
});

describe("listAnalyses", () => {
  it("returns pagination metadata", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    const r = await listAnalyses({ ...DEFAULT_FILTERS, perPage: 25, page: 1 });
    expect(r).toEqual({
      rows: [], total: 0, page: 1, perPage: 25, totalPages: 1,
    });
  });

  it("totalPages = ceil(total / perPage)", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(127);
    const r = await listAnalyses({ ...DEFAULT_FILTERS, perPage: 50 });
    expect(r.totalPages).toBe(3);
  });

  it("passes skip/take to findMany", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    await listAnalyses({ ...DEFAULT_FILTERS, page: 3, perPage: 20 });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
  });

  it("orders by createdAt desc", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    await listAnalyses(DEFAULT_FILTERS);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
  });
});

describe("buildFilterQuery", () => {
  it("returns empty string when filters match defaults", () => {
    expect(buildFilterQuery(DEFAULT_FILTERS)).toBe("");
  });

  it("includes only non-default fields", () => {
    const f: ListFilters = { ...DEFAULT_FILTERS, verdict: "STOP", fp: "FLAGGED" };
    const q = buildFilterQuery(f);
    expect(q).toContain("verdict=STOP");
    expect(q).toContain("fp=FLAGGED");
    expect(q).not.toContain("mode=");
    expect(q).not.toContain("page=");
  });

  it("includes page when not default", () => {
    expect(buildFilterQuery({ ...DEFAULT_FILTERS, page: 3 })).toBe("?page=3");
  });
});
