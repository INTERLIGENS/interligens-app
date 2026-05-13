import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reflexAnalysis: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  DEDUP_WINDOW_SECONDS,
  effectiveMode,
  findById,
  findRecentByHash,
  persistAnalysis,
  type PersistInput,
} from "@/lib/reflex/persistence";
import type {
  ReflexResolvedInput,
  ReflexVerdictResult,
} from "@/lib/reflex/types";

const mockCreate = vi.mocked(
  prisma.reflexAnalysis.create as unknown as (...a: unknown[]) => unknown,
);
const mockFindFirst = vi.mocked(
  prisma.reflexAnalysis.findFirst as unknown as (...a: unknown[]) => unknown,
);
const mockFindUnique = vi.mocked(
  prisma.reflexAnalysis.findUnique as unknown as (...a: unknown[]) => unknown,
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const SAMPLE_INPUT: ReflexResolvedInput = {
  type: "EVM_TOKEN",
  chain: "evm",
  address: "0xabc",
  raw: "0xabc",
};

const SAMPLE_VERDICT: ReflexVerdictResult = {
  verdict: "NO_CRITICAL_SIGNAL",
  verdictReasonEn: ["This is not a safety guarantee. Crypto remains hostile by default."],
  verdictReasonFr: ["Ce n'est pas une garantie de sécurité. La crypto reste hostile par défaut."],
  actionEn: "",
  actionFr: "",
  confidence: "MEDIUM",
  confidenceScore: 0.5,
};

function persistPayload(over: Partial<PersistInput> = {}): PersistInput {
  return {
    resolvedInput: SAMPLE_INPUT,
    inputRaw: "0xabc",
    engines: [],
    verdictResult: SAMPLE_VERDICT,
    signalsManifest: { engines: [] },
    signalsHash: "a".repeat(64),
    tigerScoreSnapshot: null,
    investigatorId: undefined,
    latencyMs: 42,
    enginesVersion: "reflex-test",
    ...over,
  };
}

function fakeRow(over: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    createdAt: new Date(),
    inputRaw: "0xabc",
    inputType: "EVM_TOKEN",
    inputChain: "evm",
    inputResolvedAddress: "0xabc",
    inputResolvedHandle: null,
    verdict: "NO_CRITICAL_SIGNAL",
    verdictReasonEn: SAMPLE_VERDICT.verdictReasonEn,
    verdictReasonFr: SAMPLE_VERDICT.verdictReasonFr,
    actionEn: "",
    actionFr: "",
    confidence: "MEDIUM",
    confidenceScore: 0.5,
    signalsManifest: { engines: [] },
    signalsHash: "a".repeat(64),
    tigerScoreSnapshot: null,
    mode: "SHADOW",
    investigatorId: null,
    latencyMs: 42,
    enginesVersion: "reflex-test",
    ...over,
  };
}

describe("effectiveMode — SHADOW is fail-closed default", () => {
  it("undefined → SHADOW", () => {
    expect(effectiveMode()).toBe("SHADOW");
  });

  it("requested SHADOW → SHADOW (regardless of flag)", () => {
    vi.stubEnv("REFLEX_PUBLIC_ENABLED", "true");
    expect(effectiveMode("SHADOW")).toBe("SHADOW");
  });

  it("requested PUBLIC + flag unset → SHADOW", () => {
    expect(effectiveMode("PUBLIC")).toBe("SHADOW");
  });

  it("requested PUBLIC + flag 'false' → SHADOW", () => {
    vi.stubEnv("REFLEX_PUBLIC_ENABLED", "false");
    expect(effectiveMode("PUBLIC")).toBe("SHADOW");
  });

  it("requested PUBLIC + flag 'TRUE' (case-sensitive) → SHADOW", () => {
    vi.stubEnv("REFLEX_PUBLIC_ENABLED", "TRUE");
    expect(effectiveMode("PUBLIC")).toBe("SHADOW");
  });

  it("requested PUBLIC + flag '1' → SHADOW (only literal 'true')", () => {
    vi.stubEnv("REFLEX_PUBLIC_ENABLED", "1");
    expect(effectiveMode("PUBLIC")).toBe("SHADOW");
  });

  it("requested PUBLIC + flag exactly 'true' → PUBLIC", () => {
    vi.stubEnv("REFLEX_PUBLIC_ENABLED", "true");
    expect(effectiveMode("PUBLIC")).toBe("PUBLIC");
  });
});

describe("persistAnalysis — mode is coerced through effectiveMode", () => {
  it("mode='PUBLIC' with flag off → row written as SHADOW", async () => {
    mockCreate.mockImplementation(async (args: { data: unknown }) =>
      fakeRow({ ...(args.data as Record<string, unknown>), id: "r-1" }),
    );
    const r = await persistAnalysis(persistPayload({ mode: "PUBLIC" }));
    expect(r.mode).toBe("SHADOW");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mode: "SHADOW" }),
      }),
    );
  });

  it("mode='PUBLIC' with flag on → row written as PUBLIC", async () => {
    vi.stubEnv("REFLEX_PUBLIC_ENABLED", "true");
    mockCreate.mockImplementation(async (args: { data: unknown }) =>
      fakeRow({ ...(args.data as Record<string, unknown>), id: "r-2" }),
    );
    const r = await persistAnalysis(persistPayload({ mode: "PUBLIC" }));
    expect(r.mode).toBe("PUBLIC");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mode: "PUBLIC" }),
      }),
    );
  });

  it("mode undefined → SHADOW", async () => {
    mockCreate.mockImplementation(async (args: { data: unknown }) =>
      fakeRow({ ...(args.data as Record<string, unknown>), id: "r-3" }),
    );
    const r = await persistAnalysis(persistPayload());
    expect(r.mode).toBe("SHADOW");
  });

  it("writes all spec-required fields", async () => {
    mockCreate.mockImplementation(async (args: { data: unknown }) =>
      fakeRow({ ...(args.data as Record<string, unknown>), id: "r-4" }),
    );
    await persistAnalysis(persistPayload({ tigerScoreSnapshot: 72 }));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inputRaw: "0xabc",
          inputType: "EVM_TOKEN",
          inputChain: "evm",
          inputResolvedAddress: "0xabc",
          verdict: "NO_CRITICAL_SIGNAL",
          confidence: "MEDIUM",
          signalsHash: "a".repeat(64),
          tigerScoreSnapshot: 72,
          enginesVersion: "reflex-test",
          latencyMs: 42,
        }),
      }),
    );
  });
});

describe("findRecentByHash — dedup window", () => {
  it("returns row when found within window", async () => {
    mockFindFirst.mockResolvedValue(fakeRow({ id: "found-1" }));
    const r = await findRecentByHash("a".repeat(64));
    expect(r?.id).toBe("found-1");
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ signalsHash: "a".repeat(64) }),
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("passes the time-window cutoff to Prisma", async () => {
    const t0 = Date.now();
    mockFindFirst.mockResolvedValue(null);
    await findRecentByHash("h", 30);
    const call = mockFindFirst.mock.calls[0]?.[0] as {
      where: { createdAt: { gte: Date } };
    };
    const gte = call.where.createdAt.gte;
    expect(gte.getTime()).toBeGreaterThanOrEqual(t0 - 30_000 - 100);
    expect(gte.getTime()).toBeLessThanOrEqual(t0 - 30_000 + 100);
  });

  it("returns null when no row matches", async () => {
    mockFindFirst.mockResolvedValue(null);
    expect(await findRecentByHash("nohash")).toBeNull();
  });

  it("defaults the window to DEDUP_WINDOW_SECONDS (60)", async () => {
    expect(DEDUP_WINDOW_SECONDS).toBe(60);
    mockFindFirst.mockResolvedValue(null);
    const t0 = Date.now();
    await findRecentByHash("h");
    const call = mockFindFirst.mock.calls[0]?.[0] as {
      where: { createdAt: { gte: Date } };
    };
    const gte = call.where.createdAt.gte;
    expect(gte.getTime()).toBeGreaterThanOrEqual(t0 - 60_000 - 100);
  });
});

describe("findById", () => {
  it("returns inflated row when found", async () => {
    mockFindUnique.mockResolvedValue(fakeRow({ id: "abc" }));
    const r = await findById("abc");
    expect(r?.id).toBe("abc");
    expect(r?.verdict).toBe("NO_CRITICAL_SIGNAL");
  });

  it("returns null when not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await findById("missing")).toBeNull();
  });
});
