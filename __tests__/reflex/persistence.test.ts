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
  confidenceState: "MEASURED" as const,
  coverage: { total: 0, measured: 0, expected: 0, expectedMeasured: 0, missing: [], notExpected: [] },
  degraded: false,
  conflicts: [],
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
    confidenceState: "MEASURED" as const,
    coverage: { total: 0, measured: 0, expected: 0, expectedMeasured: 0, missing: [], notExpected: [] },
    degraded: false,
    conflicts: [],
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
    mockCreate.mockImplementation(async (args) =>
      fakeRow({ ...((args as { data: unknown }).data as Record<string, unknown>), id: "r-1" }),
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
    mockCreate.mockImplementation(async (args) =>
      fakeRow({ ...((args as { data: unknown }).data as Record<string, unknown>), id: "r-2" }),
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
    mockCreate.mockImplementation(async (args) =>
      fakeRow({ ...((args as { data: unknown }).data as Record<string, unknown>), id: "r-3" }),
    );
    const r = await persistAnalysis(persistPayload());
    expect(r.mode).toBe("SHADOW");
  });

  it("writes all spec-required fields", async () => {
    mockCreate.mockImplementation(async (args) =>
      fakeRow({ ...((args as { data: unknown }).data as Record<string, unknown>), id: "r-4" }),
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

// ─── BUILD 11 — L'ÉTAT DE MESURE SURVIT À LA RELECTURE ────────────────────
//
// Mesuré en production le 2026-09-08 : une réponse dédupliquée sortait
// `confidenceState: MEASURED` avec `confidenceScore: 0`, alors que quatre
// moteurs avaient tourné SANS signal — l'état exact est NOT_APPLICABLE.
// L'axe de mesure était réeffondré sur le chemin de relecture, par le même
// raccourci que BUILD 11 ferme ailleurs.

describe("BUILD 11 — la relecture ne réeffondre pas l'axe de mesure", () => {
  const avecMoteurs = (
    verdict: string,
    engines: Array<{ engine: string; ran: boolean; signals?: unknown[] }>,
  ) =>
    fakeRow({
      verdict,
      signalsManifest: {
        engines: engines.map((e) => ({ ...e, signals: e.signals ?? [] })),
      },
    });

  it("MUTANT — des moteurs propres sans signal rendent NOT_APPLICABLE, pas MEASURED", async () => {
    mockFindUnique.mockResolvedValue(
      avecMoteurs("NO_CRITICAL_SIGNAL", [
        { engine: "knownBad", ran: true },
        { engine: "tigerscore", ran: true },
        { engine: "offchain", ran: false },
      ]),
    );
    const r = await findById("x");
    expect(r?.confidenceState).toBe("NOT_APPLICABLE");
    expect(r?.coverage.measured).toBe(2);
    // BUILD 11.1 — `offchain` sur un SOLANA_TOKEN ne s'applique pas : la
    // relecture RECALCULE la cause au lieu de la deviner, donc ce n'est plus
    // un manque et le document n'est plus dégradé.
    expect(r?.coverage.notExpected.map((m) => m.engine)).toEqual(["offchain"]);
    expect(r?.coverage.missing).toEqual([]);
    expect(r?.degraded).toBe(false);
  });

  it("MUTANT — une panne d'un ATTENDU dégrade toujours, à la relecture aussi", async () => {
    // La sur-correction inverse : le signal doit rester capable d'alerter.
    mockFindUnique.mockResolvedValue(
      avecMoteurs("NO_CRITICAL_SIGNAL", [
        { engine: "knownBad", ran: false },
        { engine: "tigerscore", ran: true },
      ]),
    );
    const r = await findById("x");
    expect(r?.coverage.missing.map((m) => m.engine)).toEqual(["knownBad"]);
    expect(r?.degraded).toBe(true);
  });

  it("aucune mesure du tout → ni score, ni label", async () => {
    mockFindUnique.mockResolvedValue(
      avecMoteurs("INSUFFICIENT_COVERAGE", [
        { engine: "knownBad", ran: false },
        { engine: "tigerscore", ran: false },
      ]),
    );
    const r = await findById("x");
    expect(r?.confidenceScore).toBeNull();
    expect(r?.confidence).toBeNull();
    expect(r?.coverage.measured).toBe(0);
  });

  it("`error` n'étant pas persisté, un ATTENDU manquant sort en UNKNOWN — et le dit", async () => {
    // Ce qui reste réellement perdu après coup : une panne et un « jamais
    // sollicité sans cause » se confondent. UNKNOWN est le mot pour ça, et il
    // reste RÉSERVÉ à ce cas — les causes connues, elles, sont recalculées.
    mockFindUnique.mockResolvedValue(
      avecMoteurs("NO_CRITICAL_SIGNAL", [{ engine: "knownBad", ran: false }]),
    );
    const r = await findById("x");
    expect(r?.coverage.missing.map((m) => m.reason)).toEqual(["UNKNOWN"]);
    expect(r?.coverage.missing.map((m) => m.reason)).not.toContain("STALE");
  });
});
