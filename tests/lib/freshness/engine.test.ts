import { describe, it, expect, vi } from "vitest";
import { computeFreshnessSignals, ageToSeverity } from "@/lib/freshness/engine";

// ── Mock factory helpers ───────────────────────────────────────────────────

function makeSigsResponse(blockTimeMs: number) {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    result: [{ signature: "sig1", blockTime: Math.floor(blockTimeMs / 1000) }],
  });
}

function makeNullResponse() {
  return JSON.stringify({ jsonrpc: "2.0", id: 1, result: null });
}

function makeEmptyAuthority() {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    result: { value: { data: { parsed: { info: { mintAuthority: null } } } } },
  });
}

function ok(body: string) {
  return Promise.resolve(new Response(body, { status: 200, headers: { "Content-Type": "application/json" } }));
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("ageToSeverity", () => {
  it("returns CRITICAL for age < 6h", () => {
    expect(ageToSeverity(4 * 3_600_000)).toBe("CRITICAL");
  });
  it("returns HIGH for age 6-24h", () => {
    expect(ageToSeverity(12 * 3_600_000)).toBe("HIGH");
  });
  it("returns MEDIUM for age 24-72h", () => {
    expect(ageToSeverity(48 * 3_600_000)).toBe("MEDIUM");
  });
  it("returns LOW for age 72-168h", () => {
    expect(ageToSeverity(100 * 3_600_000)).toBe("LOW");
  });
  it("returns NONE for age > 7d", () => {
    expect(ageToSeverity(200 * 3_600_000)).toBe("NONE");
  });
});

describe("computeFreshnessSignals", () => {
  it("test 1 — token_age < 6h → severity CRITICAL", async () => {
    const tokenCreatedMs = Date.now() - 4 * 3_600_000;

    let callCount = 0;
    const mockFetch = vi.fn(() => {
      callCount++;
      // call 1: getSignaturesForAddress (mint) → 4h ago
      if (callCount === 1) return ok(makeSigsResponse(tokenCreatedMs));
      // call 2: getParsedAccountInfo (mintAuthority) → null
      return ok(makeEmptyAuthority());
    });

    const result = await computeFreshnessSignals(
      { chain: "solana", mint: "TokenMint111111111111111111111111111111111" },
      mockFetch as unknown as typeof fetch,
    );

    expect(result.severity).toBe("CRITICAL");
    const sig = result.signals.find((s) => s.id.startsWith("token_age"));
    expect(sig).toBeDefined();
    expect(sig!.severity).toBe("CRITICAL");
    expect(sig!.label_en).toMatch(/TOKEN/);
  });

  it("test 2 — deployer_age 6-24h → severity HIGH (pool path)", async () => {
    const poolCreatedAt = new Date(Date.now() - 12 * 3_600_000);

    const result = await computeFreshnessSignals(
      { chain: "solana", poolCreatedAt },
      vi.fn(() => ok(makeNullResponse())) as unknown as typeof fetch,
    );

    const sig = result.signals.find((s) => s.id.startsWith("pool_age"));
    expect(sig).toBeDefined();
    expect(sig!.severity).toBe("HIGH");
    expect(sig!.label_en).toMatch(/POOL/);
  });

  it("test 3 — pool_age 24-72h → severity MEDIUM", async () => {
    const poolCreatedAt = new Date(Date.now() - 48 * 3_600_000);

    const result = await computeFreshnessSignals(
      { chain: "solana", poolCreatedAt },
      vi.fn(() => ok(makeNullResponse())) as unknown as typeof fetch,
    );

    const sig = result.signals.find((s) => s.id.startsWith("pool_age"));
    expect(sig).toBeDefined();
    expect(sig!.severity).toBe("MEDIUM");
  });

  it("test 4 — age > 7d → severity NONE, signals vide", async () => {
    const oldTs = Date.now() - 200 * 3_600_000;

    const mockFetch = vi.fn((url: unknown, opts: unknown) => {
      const body = (opts as { body?: string })?.body ?? "";
      if (body.includes("getSignaturesForAddress")) return ok(makeSigsResponse(oldTs));
      return ok(makeEmptyAuthority());
    });

    const result = await computeFreshnessSignals(
      { chain: "solana", mint: "OldTokenMint111111111111111111111111111111" },
      mockFetch as unknown as typeof fetch,
    );

    expect(result.severity).toBe("NONE");
    expect(result.signals.length).toBe(0);
  });

  it("test 5 — multi-signaux combinés → score_contribution capped à 15", async () => {
    const veryFreshMs = Date.now() - 1 * 3_600_000;

    // pool_age CRITICAL + deployer via explicit deployer with poolCreatedAt + token
    const poolCreatedAt = new Date(veryFreshMs);

    let callCount = 0;
    const mockFetch = vi.fn(() => {
      callCount++;
      // getSignaturesForAddress → fresh (CRITICAL each time)
      return ok(makeSigsResponse(veryFreshMs));
    });

    const result = await computeFreshnessSignals(
      {
        chain: "solana",
        mint: "FreshMint1111111111111111111111111111111111",
        deployer: "FreshDeployer11111111111111111111111111111",
        poolCreatedAt,
      },
      mockFetch as unknown as typeof fetch,
    );

    expect(result.score_contribution).toBeLessThanOrEqual(15);
    expect(result.severity).toBe("CRITICAL");
    expect(result.signals.length).toBeGreaterThanOrEqual(1);
  });

  it("test 6 — Helius timeout → severity NONE sans crash", async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error("Network timeout")));

    const result = await computeFreshnessSignals(
      { chain: "solana", mint: "AnyMint1111111111111111111111111111111111" },
      mockFetch as unknown as typeof fetch,
    );

    expect(result.severity).toBe("NONE");
    expect(result.signals.length).toBe(0);
    expect(result.score_contribution).toBe(0);
  });
});
