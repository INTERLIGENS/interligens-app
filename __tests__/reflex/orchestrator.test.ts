import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock all engine adapters at the module level so we can drive the
// orchestrator under test without touching real engines / Prisma.

vi.mock("@/lib/reflex/adapters", () => ({
  runKnownBad: vi.fn(),
  runTigerScore: vi.fn(),
  runOffChain: vi.fn(),
  runCoordination: vi.fn(),
  runIntelligenceOverlay: vi.fn(),
  runNarrative: vi.fn(),
}));
vi.mock("@/lib/reflex/recidivism", () => ({ runRecidivism: vi.fn() }));
vi.mock("@/lib/reflex/casefileMatch", () => ({ runCasefileMatch: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    reflexAnalysis: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import {
  runKnownBad,
  runTigerScore,
  runOffChain,
  runCoordination,
  runIntelligenceOverlay,
  runNarrative,
} from "@/lib/reflex/adapters";
import { runRecidivism } from "@/lib/reflex/recidivism";
import { runCasefileMatch } from "@/lib/reflex/casefileMatch";
import { prisma } from "@/lib/prisma";
import { runReflex } from "@/lib/reflex/orchestrator";
import { REFLEX_ENGINES_VERSION } from "@/lib/reflex/constants";
import type {
  ReflexEngineOutput,
  ReflexSignalSource,
} from "@/lib/reflex/types";

const mockKnownBad = vi.mocked(runKnownBad);
const mockTigerScore = vi.mocked(runTigerScore);
const mockOffChain = vi.mocked(runOffChain);
const mockCoordination = vi.mocked(runCoordination);
const mockIntel = vi.mocked(runIntelligenceOverlay);
const mockNarrative = vi.mocked(runNarrative);
const mockRecidivism = vi.mocked(runRecidivism);
const mockCasefile = vi.mocked(runCasefileMatch);

const mockCreate = vi.mocked(
  prisma.reflexAnalysis.create as unknown as (...a: unknown[]) => unknown,
);
const mockFindFirst = vi.mocked(
  prisma.reflexAnalysis.findFirst as unknown as (...a: unknown[]) => unknown,
);

function clean(engine: ReflexEngineOutput["engine"]): ReflexEngineOutput {
  return { engine, ran: true, ms: 0, signals: [] };
}

function fakeRow(args: { data: Record<string, unknown> }) {
  return {
    id: "row-" + Math.random().toString(36).slice(2, 8),
    createdAt: new Date(),
    ...args.data,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();

  // Default: every adapter returns clean (ran=true, no signals)
  mockKnownBad.mockReturnValue(clean("knownBad"));
  mockTigerScore.mockResolvedValue(clean("tigerscore"));
  mockOffChain.mockResolvedValue(clean("offchain"));
  mockCoordination.mockResolvedValue(clean("coordination"));
  mockIntel.mockResolvedValue(clean("intelligenceOverlay"));
  mockNarrative.mockResolvedValue(clean("narrative"));
  mockRecidivism.mockResolvedValue(clean("recidivism"));
  mockCasefile.mockResolvedValue(clean("casefileMatch"));

  // Default: no dedup hit, create returns the row args
  mockFindFirst.mockResolvedValue(null);
  mockCreate.mockImplementation(async (a) => fakeRow(a as { data: Record<string, unknown> }));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── Adapter fan-out + applicability gating ───────────────────────────────

describe("runReflex — adapter fan-out", () => {
  it("always calls knownBad, intel, recidivism, casefile, coordination", async () => {
    await runReflex("@testkol");
    expect(mockKnownBad).toHaveBeenCalledTimes(1);
    expect(mockIntel).toHaveBeenCalledTimes(1);
    expect(mockRecidivism).toHaveBeenCalledTimes(1);
    expect(mockCasefile).toHaveBeenCalledTimes(1);
    expect(mockCoordination).toHaveBeenCalledTimes(1);
  });

  it("skips tigerscore when no tigerInput enrichment", async () => {
    await runReflex("@testkol");
    expect(mockTigerScore).not.toHaveBeenCalled();
  });

  it("calls tigerscore when tigerInput is supplied", async () => {
    await runReflex("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "SHADOW", {
      enrichment: { tigerInput: { chain: "ETH" } },
    });
    expect(mockTigerScore).toHaveBeenCalledTimes(1);
    expect(mockTigerScore).toHaveBeenCalledWith(
      expect.objectContaining({
        tigerInput: { chain: "ETH" },
        withIntel: true,
      }),
    );
  });

  it("skips offchain when no offChainInput enrichment", async () => {
    await runReflex("@testkol");
    expect(mockOffChain).not.toHaveBeenCalled();
  });

  it("calls offchain when offChainInput is supplied", async () => {
    await runReflex("https://example.com", "SHADOW", {
      enrichment: { offChainInput: { websiteUrl: "https://example.com" } },
    });
    expect(mockOffChain).toHaveBeenCalledTimes(1);
  });

  it("skips narrative when no narrativeText enrichment", async () => {
    await runReflex("@testkol");
    expect(mockNarrative).not.toHaveBeenCalled();
  });

  it("calls narrative when narrativeText is supplied", async () => {
    await runReflex("@testkol", "SHADOW", {
      enrichment: { narrativeText: "Binance listing imminent!" },
    });
    expect(mockNarrative).toHaveBeenCalledTimes(1);
    expect(mockNarrative).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Binance listing imminent!" }),
    );
  });
});

// ─── Mode enforcement (the user-mandated invariant) ──────────────────────

describe("runReflex — SHADOW is fail-closed default", () => {
  it("mode='PUBLIC' with REFLEX_PUBLIC_ENABLED unset → persisted as SHADOW", async () => {
    const r = await runReflex("@testkol", "PUBLIC");
    expect(r.mode).toBe("SHADOW");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mode: "SHADOW" }),
      }),
    );
  });

  it("mode='PUBLIC' with REFLEX_PUBLIC_ENABLED='false' → SHADOW", async () => {
    vi.stubEnv("REFLEX_PUBLIC_ENABLED", "false");
    const r = await runReflex("@testkol", "PUBLIC");
    expect(r.mode).toBe("SHADOW");
  });

  it("mode='PUBLIC' with REFLEX_PUBLIC_ENABLED='true' → PUBLIC", async () => {
    vi.stubEnv("REFLEX_PUBLIC_ENABLED", "true");
    const r = await runReflex("@testkol", "PUBLIC");
    expect(r.mode).toBe("PUBLIC");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mode: "PUBLIC" }),
      }),
    );
  });

  it("mode default (no arg) → SHADOW, even with flag on", async () => {
    vi.stubEnv("REFLEX_PUBLIC_ENABLED", "true");
    const r = await runReflex("@testkol");
    expect(r.mode).toBe("SHADOW");
  });
});

// ─── Dedup behaviour ─────────────────────────────────────────────────────

describe("runReflex — signalsHash dedup", () => {
  it("returns existing row when same hash is recent", async () => {
    mockFindFirst.mockResolvedValue({
      id: "deduped-row",
      createdAt: new Date(),
      inputRaw: "@testkol",
      inputType: "X_HANDLE",
      inputChain: null,
      inputResolvedAddress: null,
      inputResolvedHandle: "testkol",
      verdict: "NO_CRITICAL_SIGNAL",
      verdictReasonEn: [],
      verdictReasonFr: [],
      actionEn: "",
      actionFr: "",
      confidence: "MEDIUM",
      confidenceScore: 0.5,
      signalsManifest: { engines: [] },
      signalsHash: "x".repeat(64),
      tigerScoreSnapshot: null,
      mode: "SHADOW",
      investigatorId: null,
      latencyMs: 0,
      enginesVersion: REFLEX_ENGINES_VERSION,
    });

    const r = await runReflex("@testkol");
    expect(r.id).toBe("deduped-row");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("two same calls within the window → same id, only one DB write", async () => {
    let stored: Record<string, unknown> | null = null;

    mockFindFirst.mockImplementation(async () => stored);
    mockCreate.mockImplementation(async (a) => {
      const data = (a as { data: Record<string, unknown> }).data;
      stored = { id: "stored-id", createdAt: new Date(), ...data };
      return stored;
    });

    const r1 = await runReflex("@testkol");
    const r2 = await runReflex("@testkol");
    expect(r1.id).toBe(r2.id);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("custom dedupWindowSeconds is forwarded", async () => {
    await runReflex("@testkol", "SHADOW", { dedupWindowSeconds: 5 });
    const findCall = mockFindFirst.mock.calls[0]?.[0] as {
      where: { createdAt: { gte: Date } };
    };
    const gte = findCall.where.createdAt.gte;
    const t0 = Date.now();
    // Window should be ~5s (with up to ~100ms tolerance for the call itself)
    expect(gte.getTime()).toBeGreaterThanOrEqual(t0 - 5_000 - 200);
    expect(gte.getTime()).toBeLessThanOrEqual(t0 - 5_000 + 200);
  });
});

// ─── Persisted shape ──────────────────────────────────────────────────────

describe("runReflex — persisted row shape", () => {
  it("includes the engines version", async () => {
    await runReflex("@testkol");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ enginesVersion: REFLEX_ENGINES_VERSION }),
      }),
    );
  });

  it("threads investigatorId through to the row", async () => {
    await runReflex("@testkol", "SHADOW", { investigatorId: "inv-7" });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ investigatorId: "inv-7" }),
      }),
    );
  });

  it("captures latencyMs >= 0", async () => {
    const r = await runReflex("@testkol");
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("extracts tigerScoreSnapshot from tigerscore.raw.score", async () => {
    mockTigerScore.mockResolvedValue({
      engine: "tigerscore",
      ran: true,
      ms: 0,
      signals: [],
      raw: { score: 72, tier: "ORANGE", drivers: [], confidence: "Medium" },
    });
    await runReflex("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "SHADOW", {
      enrichment: { tigerInput: { chain: "ETH" } },
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tigerScoreSnapshot: 72 }),
      }),
    );
  });

  it("tigerScoreSnapshot=null when tigerscore did not run", async () => {
    await runReflex("@testkol");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tigerScoreSnapshot: null }),
      }),
    );
  });

  it("classifies UNKNOWN input and still persists a row", async () => {
    const r = await runReflex("not a recognisable input at all 12345");
    expect(r.input.type).toBe("UNKNOWN");
    expect(mockCreate).toHaveBeenCalled();
  });

  it("verdict reasons + confidence come from the V1 matrix on empty signals", async () => {
    const r = await runReflex("@testkol");
    // All engines clean → NO_CRITICAL_SIGNAL with disclaimer
    expect(r.verdict).toBe("NO_CRITICAL_SIGNAL");
    expect(r.verdictReasonEn.length).toBeGreaterThan(0);
    expect(r.verdictReasonFr.length).toBeGreaterThan(0);
  });
});

// ─── Sanity: STOP path drives a real verdict, not just NO_CRITICAL ──────

describe("runReflex — verdict produced from adapter signals", () => {
  it("knownBad stopTrigger surface flows through to verdict=STOP", async () => {
    const source: ReflexSignalSource = "knownBad";
    mockKnownBad.mockReturnValue({
      engine: "knownBad",
      ran: true,
      ms: 0,
      signals: [{
        source,
        code: "knownBad.scam.eth",
        severity: "CRITICAL",
        confidence: 1.0,
        stopTrigger: true,
        reasonEn: "Address matches a known risk pattern.",
        reasonFr: "L'adresse correspond à un schéma de risque connu.",
      }],
    });
    const r = await runReflex("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
    expect(r.verdict).toBe("STOP");
  });
});
