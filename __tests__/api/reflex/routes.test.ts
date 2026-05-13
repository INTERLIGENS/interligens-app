/**
 * REFLEX V1 — route handler integration tests.
 *
 * Covers POST /api/reflex, GET /api/reflex/:id, POST .../watch, POST and
 * GET .../proof-pack (stub). The pipeline itself is tested elsewhere
 * (orchestrator.test.ts, verdict.matrix.test.ts) — these tests focus on
 * the HTTP surface: validation, mode threading, locale selection, error
 * shapes, and route-to-orchestrator wiring.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/security/rateLimit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 99 })),
  rateLimitResponse: vi.fn(),
  getClientIp: () => "127.0.0.1",
  detectLocale: () => "en",
  RATE_LIMIT_PRESETS: { scan: {} },
}));

vi.mock("@/lib/reflex/orchestrator", () => ({
  runReflex: vi.fn(),
}));

vi.mock("@/lib/scan/buildTigerInput", () => ({
  buildTigerInputForReflex: vi.fn(async () => ({
    supported: false,
    reason: "test-mock",
  })),
}));

vi.mock("@/lib/reflex/persistence", () => ({
  findById: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reflexWatch: { create: vi.fn() },
  },
}));

vi.mock("@/lib/security/investigatorAuth", () => ({
  getSessionTokenFromReq: vi.fn(() => null),
  isValidSessionToken: vi.fn(async () => false),
}));

import { runReflex } from "@/lib/reflex/orchestrator";
import {
  getSessionTokenFromReq,
  isValidSessionToken,
} from "@/lib/security/investigatorAuth";
import { findById } from "@/lib/reflex/persistence";
import { prisma } from "@/lib/prisma";
import { POST as postReflex } from "@/app/api/reflex/route";
import { GET as getById } from "@/app/api/reflex/[id]/route";
import { POST as postWatch } from "@/app/api/reflex/[id]/watch/route";
import {
  POST as postProofPack,
  GET as getProofPack,
} from "@/app/api/reflex/[id]/proof-pack/route";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { NextRequest } from "next/server";
import { MAX_INPUT_LENGTH } from "@/lib/reflex/constants";
import type { ReflexAnalysisResult } from "@/lib/reflex/types";

const mockRunReflex = vi.mocked(runReflex);
const mockFindById = vi.mocked(findById);
const mockWatchCreate = vi.mocked(
  prisma.reflexWatch.create as unknown as (...a: unknown[]) => unknown,
);
const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockRateLimitResponse = vi.mocked(rateLimitResponse);
const mockGetSessionToken = vi.mocked(getSessionTokenFromReq);
const mockIsValidSession = vi.mocked(isValidSessionToken);

function makePostReq(body: unknown): NextRequest {
  return new NextRequest(
    new Request("http://localhost/api/reflex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

function makeGetReq(): NextRequest {
  return new NextRequest(new Request("http://localhost/api/reflex/x"));
}

function makeAnalysis(over: Partial<ReflexAnalysisResult> = {}): ReflexAnalysisResult {
  return {
    id: "row-1",
    createdAt: new Date("2026-05-13T10:00:00Z"),
    input: {
      type: "X_HANDLE",
      handle: "testkol",
      raw: "@testkol",
    },
    signals: [],
    signalsManifest: { engines: [] },
    signalsHash: "a".repeat(64),
    enginesVersion: "reflex-v1.0.0",
    mode: "SHADOW",
    latencyMs: 42,
    verdict: "NO_CRITICAL_SIGNAL",
    verdictReasonEn: ["disclaimer EN"],
    verdictReasonFr: ["disclaimer FR"],
    actionEn: "",
    actionFr: "",
    confidence: "MEDIUM",
    confidenceScore: 0.5,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // vi.clearAllMocks() preserves implementations across tests, so any
  // per-test mockReturnValue/mockResolvedValue leaks into the next test.
  // Re-pin the defaults explicitly so each test starts from a clean state.
  mockCheckRateLimit.mockResolvedValue({
    allowed: true,
    remaining: 99,
  } as Awaited<ReturnType<typeof checkRateLimit>>);
  mockGetSessionToken.mockReturnValue(null);
  mockIsValidSession.mockResolvedValue(false);
});

// ─── POST /api/reflex ─────────────────────────────────────────────────────

describe("POST /api/reflex — validation", () => {
  it("rate-limited request returns the rate-limit response", async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
    } as Awaited<ReturnType<typeof checkRateLimit>>);
    mockRateLimitResponse.mockReturnValue(
      new Response("rate limited", { status: 429 }) as unknown as ReturnType<
        typeof rateLimitResponse
      >,
    );
    const res = await postReflex(makePostReq({ input: "@testkol" }));
    expect(res.status).toBe(429);
    expect(mockRunReflex).not.toHaveBeenCalled();
  });

  it("malformed JSON → 400 invalid_json", async () => {
    const res = await postReflex(makePostReq("not-json"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_json");
  });

  it("missing input → 400 missing_input", async () => {
    const res = await postReflex(makePostReq({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing_input");
  });

  it("empty/whitespace input → 400 missing_input", async () => {
    const res = await postReflex(makePostReq({ input: "   " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_input");
  });

  it("input > MAX_INPUT_LENGTH → 400 input_too_long", async () => {
    const res = await postReflex(
      makePostReq({ input: "a".repeat(MAX_INPUT_LENGTH + 1) }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("input_too_long");
    expect(body.limit).toBe(MAX_INPUT_LENGTH);
  });
});

describe("POST /api/reflex — happy path + mode threading", () => {
  it("returns localized EN reason when locale='en'", async () => {
    mockRunReflex.mockResolvedValue(makeAnalysis({ mode: "SHADOW" }));
    const res = await postReflex(
      makePostReq({ input: "@testkol", locale: "en" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verdictReason).toEqual(["disclaimer EN"]);
    expect(body.mode).toBe("SHADOW");
    expect(body.signalsHashShort).toMatch(/^[a-f0-9]{8}$/);
  });

  it("returns localized FR reason when locale='fr'", async () => {
    mockRunReflex.mockResolvedValue(makeAnalysis());
    const res = await postReflex(
      makePostReq({ input: "@testkol", locale: "fr" }),
    );
    const body = await res.json();
    expect(body.verdictReason).toEqual(["disclaimer FR"]);
  });

  it("threads mode='PUBLIC' through to runReflex", async () => {
    mockRunReflex.mockResolvedValue(makeAnalysis({ mode: "PUBLIC" }));
    await postReflex(makePostReq({ input: "@testkol", mode: "PUBLIC" }));
    expect(mockRunReflex).toHaveBeenCalledWith(
      "@testkol",
      "PUBLIC",
      expect.any(Object),
    );
  });

  it("defaults mode to SHADOW when not provided", async () => {
    mockRunReflex.mockResolvedValue(makeAnalysis());
    await postReflex(makePostReq({ input: "@testkol" }));
    expect(mockRunReflex).toHaveBeenCalledWith(
      "@testkol",
      "SHADOW",
      expect.any(Object),
    );
  });

  it("response.mode reflects what orchestrator persisted, NOT what was requested", async () => {
    // Caller asks for PUBLIC but orchestrator coerces to SHADOW
    mockRunReflex.mockResolvedValue(makeAnalysis({ mode: "SHADOW" }));
    const res = await postReflex(
      makePostReq({ input: "@testkol", mode: "PUBLIC" }),
    );
    const body = await res.json();
    expect(body.mode).toBe("SHADOW");
  });

  it("orchestrator error → 500 internal", async () => {
    mockRunReflex.mockRejectedValue(new Error("DB unreachable"));
    const res = await postReflex(makePostReq({ input: "@testkol" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("internal");
    expect(body.detail).toContain("DB unreachable");
  });

  it("lint leak (ForbiddenWordError) → 500 lint_leak (never serves)", async () => {
    const { ForbiddenWordError } = await import(
      "@/lib/reflex/forbidden-words"
    );
    mockRunReflex.mockRejectedValue(
      new ForbiddenWordError(
        [{ token: "scam", snippet: "...scam...", index: 0 }],
        "verdict.STOP",
      ),
    );
    const res = await postReflex(makePostReq({ input: "@testkol" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("lint_leak");
    expect(body.source).toBe("verdict.STOP");
  });
});

// ─── GET /api/reflex/:id ──────────────────────────────────────────────────

describe("GET /api/reflex/:id", () => {
  it("returns 404 when not found", async () => {
    mockFindById.mockResolvedValue(null);
    const res = await getById(makeGetReq(), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns redacted summary by default (no investigator session)", async () => {
    // Default mocks: getSessionTokenFromReq → null, so no full view.
    const analysis = makeAnalysis({ id: "row-77", mode: "SHADOW" });
    mockFindById.mockResolvedValue(analysis);
    const res = await getById(makeGetReq(), {
      params: Promise.resolve({ id: "row-77" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    // Summary fields present
    expect(body.id).toBe("row-77");
    expect(body.verdict).toBe("NO_CRITICAL_SIGNAL");
    expect(body.verdictReasonEn).toEqual(["disclaimer EN"]);
    expect(body.verdictReasonFr).toEqual(["disclaimer FR"]);
    expect(body.confidence).toBe("MEDIUM");
    expect(body.signalsHashShort).toBe("a".repeat(8));
    // Recipe fields ABSENT — these reveal the architecture but not the recipe.
    expect(body.signalsHash).toBeUndefined();
    expect(body.signalsManifest).toBeUndefined();
    expect(body.input).toBeUndefined();
    expect(body.mode).toBeUndefined();
    expect(body.enginesVersion).toBeUndefined();
    expect(body.latencyMs).toBeUndefined();
  });

  it("SHADOW row + valid investigator session → manifest present (full view)", async () => {
    mockGetSessionToken.mockReturnValue("valid-token");
    mockIsValidSession.mockResolvedValue(true);
    const analysis = makeAnalysis({ id: "row-77", mode: "SHADOW" });
    mockFindById.mockResolvedValue(analysis);
    const res = await getById(makeGetReq(), {
      params: Promise.resolve({ id: "row-77" }),
    });
    const body = await res.json();
    // Full manifest exposed
    expect(body.signalsHash).toBe("a".repeat(64));
    expect(body.signalsManifest).toEqual({ engines: [] });
    expect(body.input).toEqual(
      expect.objectContaining({
        type: "X_HANDLE",
        handle: "testkol",
        raw: "@testkol",
      }),
    );
    expect(body.mode).toBe("SHADOW");
    expect(body.enginesVersion).toBe("reflex-v1.0.0");
    expect(body.latencyMs).toBe(42);
    // session was actually validated against the DB
    expect(mockIsValidSession).toHaveBeenCalledWith("valid-token");
  });

  it("PUBLIC row + no session → manifest absent, summary only", async () => {
    // No session — getSessionToken returns null by default.
    const analysis = makeAnalysis({ id: "row-77", mode: "PUBLIC" });
    mockFindById.mockResolvedValue(analysis);
    const res = await getById(makeGetReq(), {
      params: Promise.resolve({ id: "row-77" }),
    });
    const body = await res.json();
    expect(body.signalsManifest).toBeUndefined();
    expect(body.signalsHash).toBeUndefined();
    expect(body.input).toBeUndefined();
    expect(body.signalsHashShort).toBe("a".repeat(8));
    // No DB lookup attempted when no token is present.
    expect(mockIsValidSession).not.toHaveBeenCalled();
  });

  it("PUBLIC row + valid investigator session → STILL redacted (mode wins)", async () => {
    mockGetSessionToken.mockReturnValue("valid-token");
    mockIsValidSession.mockResolvedValue(true);
    const analysis = makeAnalysis({ id: "row-77", mode: "PUBLIC" });
    mockFindById.mockResolvedValue(analysis);
    const res = await getById(makeGetReq(), {
      params: Promise.resolve({ id: "row-77" }),
    });
    const body = await res.json();
    // PUBLIC rows are public-shaped regardless of who asks
    expect(body.signalsManifest).toBeUndefined();
    expect(body.signalsHashShort).toBe("a".repeat(8));
  });

  it("SHADOW row + invalid session token → redacted", async () => {
    mockGetSessionToken.mockReturnValue("expired-token");
    mockIsValidSession.mockResolvedValue(false);
    const analysis = makeAnalysis({ id: "row-77", mode: "SHADOW" });
    mockFindById.mockResolvedValue(analysis);
    const res = await getById(makeGetReq(), {
      params: Promise.resolve({ id: "row-77" }),
    });
    const body = await res.json();
    expect(body.signalsManifest).toBeUndefined();
    expect(body.signalsHashShort).toBe("a".repeat(8));
    expect(mockIsValidSession).toHaveBeenCalledWith("expired-token");
  });
});

// ─── POST /api/reflex/:id/watch ──────────────────────────────────────────

describe("POST /api/reflex/:id/watch", () => {
  it("returns 404 when the analysis does not exist", async () => {
    mockFindById.mockResolvedValue(null);
    const req = new NextRequest(
      new Request("http://localhost/api/reflex/x/watch", { method: "POST" }),
    );
    const res = await postWatch(req, {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(res.status).toBe(404);
    expect(mockWatchCreate).not.toHaveBeenCalled();
  });

  it("creates a ReflexWatch with default 30-day TTL", async () => {
    mockFindById.mockResolvedValue(
      makeAnalysis({
        id: "row-1",
        input: {
          type: "EVM_TOKEN",
          chain: "evm",
          address: "0xabc",
          raw: "0xabc",
        },
      }),
    );
    mockWatchCreate.mockImplementation(async (args: { data: unknown }) => ({
      id: "watch-1",
      ...(args.data as Record<string, unknown>),
    }));

    const req = new NextRequest(
      new Request("http://localhost/api/reflex/row-1/watch", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    const res = await postWatch(req, {
      params: Promise.resolve({ id: "row-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.watchId).toBe("watch-1");
    expect(body.target).toBe("0xabc");
    expect(body.targetType).toBe("TOKEN");
    expect(body.status).toBe("ACTIVE");
  });

  it("honours ttlDays when supplied (and within bounds)", async () => {
    mockFindById.mockResolvedValue(
      makeAnalysis({
        input: { type: "X_HANDLE", handle: "kol", raw: "@kol" },
      }),
    );
    mockWatchCreate.mockImplementation(async (args: { data: unknown }) => ({
      id: "watch-2",
      ...(args.data as Record<string, unknown>),
    }));
    const t0 = Date.now();
    const req = new NextRequest(
      new Request("http://localhost/api/reflex/row-1/watch", {
        method: "POST",
        body: JSON.stringify({ ttlDays: 7 }),
      }),
    );
    const res = await postWatch(req, {
      params: Promise.resolve({ id: "row-1" }),
    });
    const body = await res.json();
    const expiresAt = new Date(body.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThan(t0 + 6 * 86_400_000);
    expect(expiresAt).toBeLessThan(t0 + 8 * 86_400_000);
    expect(body.targetType).toBe("HANDLE");
  });

  it("rejects ttlDays out of bounds (falls back to default)", async () => {
    mockFindById.mockResolvedValue(
      makeAnalysis({
        input: { type: "X_HANDLE", handle: "kol", raw: "@kol" },
      }),
    );
    mockWatchCreate.mockImplementation(async (args: { data: unknown }) => ({
      id: "watch-3",
      ...(args.data as Record<string, unknown>),
    }));
    const t0 = Date.now();
    const req = new NextRequest(
      new Request("http://localhost/api/reflex/row-1/watch", {
        method: "POST",
        body: JSON.stringify({ ttlDays: 9999 }),
      }),
    );
    const res = await postWatch(req, {
      params: Promise.resolve({ id: "row-1" }),
    });
    const body = await res.json();
    const expiresAt = new Date(body.expiresAt).getTime();
    // Default 30 days
    expect(expiresAt).toBeGreaterThan(t0 + 29 * 86_400_000);
    expect(expiresAt).toBeLessThan(t0 + 31 * 86_400_000);
  });
});

// ─── /api/reflex/:id/proof-pack — stub ───────────────────────────────────

describe("/api/reflex/:id/proof-pack — stub until Commit 10", () => {
  it("POST → 501 proof_pack_not_implemented", async () => {
    const res = await postProofPack();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toBe("proof_pack_not_implemented");
    expect(body.availableIn).toBe("commit-10");
  });

  it("GET → 501 proof_pack_not_implemented", async () => {
    const res = await getProofPack();
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toBe("proof_pack_not_implemented");
  });
});
