import { describe, it, expect, vi } from "vitest";
import { checkDestinationRisk } from "@/lib/destination-risk/checker";
import type { LabelLookupFn, VaultScanFn } from "@/lib/destination-risk/checker";

// ── Mock factory helpers ──────────────────────────────────────────────────────

function ok(body: object) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function makeHeliusResponse(sigs: Array<{ blockTime: number }>) {
  return { jsonrpc: "2.0", id: 1, result: sigs };
}

const DEAD_ADDRESS = "0xDeadBeefDeadBeefDeadBeefDeadBeefDeadBeef";
const SOL_ADDRESS  = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("checkDestinationRisk", () => {
  it("test 1 — Intel Vault KNOWN_SCAMMER → CRITICAL", async () => {
    const mockLookup: LabelLookupFn = vi.fn().mockResolvedValue({
      label: "GordonGekko — confirmed scammer",
      category: "scammer",
      source: "intel",
    });

    const result = await checkDestinationRisk(
      { destination: DEAD_ADDRESS, chain: "ethereum" },
      mockLookup,
    );

    expect(result.risk_level).toBe("CRITICAL");
    expect(result.recommended_action).toBe("BLOCK");
    expect(result.flags.some((f) => f.type === "KNOWN_SCAMMER")).toBe(true);
    expect(result.intel_match).toBe(true);
  });

  it("test 2 — Vault severity high → TigerScore > 70 → HIGH", async () => {
    const mockLookup: LabelLookupFn = vi.fn().mockResolvedValue(null);
    const mockVault: VaultScanFn    = vi.fn().mockResolvedValue({
      severity: "high",
      match: true,
      categories: ["phishing"],
    });

    const result = await checkDestinationRisk(
      { destination: DEAD_ADDRESS, chain: "ethereum" },
      mockLookup,
      mockVault,
    );

    expect(result.risk_level).toBe("HIGH");
    expect(result.tiger_score).toBeGreaterThan(70);
    expect(result.recommended_action).toBe("WARN");
    expect(result.intel_match).toBe(true);
  });

  it("test 3 — Fresh wallet < 7 days → MEDIUM FRESH_WALLET", async () => {
    const mockLookup: LabelLookupFn = vi.fn().mockResolvedValue(null);
    const mockVault: VaultScanFn    = vi.fn().mockResolvedValue(null);

    const recentBlockTime = Math.floor(Date.now() / 1000) - 2 * 86_400; // 2 days ago
    const mockFetch = vi.fn(() =>
      ok(makeHeliusResponse([
        { blockTime: recentBlockTime },
        { blockTime: recentBlockTime - 3600 },
      ])),
    );

    process.env.HELIUS_API_KEY = "test-key";

    const result = await checkDestinationRisk(
      { destination: SOL_ADDRESS, chain: "solana" },
      mockLookup,
      mockVault,
      mockFetch as unknown as typeof fetch,
    );

    expect(result.risk_level).toBe("MEDIUM");
    expect(result.flags.some((f) => f.type === "FRESH_WALLET")).toBe(true);
    expect(result.recommended_action).toBe("WARN");
  });

  it("test 4 — clean address → SAFE PROCEED", async () => {
    const mockLookup: LabelLookupFn = vi.fn().mockResolvedValue(null);
    const mockVault: VaultScanFn    = vi.fn().mockResolvedValue(null);
    const mockFetch = vi.fn(() =>
      ok({ jsonrpc: "2.0", id: 1, result: null }),
    );

    const result = await checkDestinationRisk(
      { destination: SOL_ADDRESS, chain: "solana" },
      mockLookup,
      mockVault,
      mockFetch as unknown as typeof fetch,
    );

    expect(result.risk_level).toBe("SAFE");
    expect(result.recommended_action).toBe("PROCEED");
    expect(result.flags).toHaveLength(0);
    expect(result.intel_match).toBe(false);
  });

  it("test 5 — OFAC match → CRITICAL BLACKLIST", async () => {
    const mockLookup: LabelLookupFn = vi.fn().mockResolvedValue({
      label: "OFAC Sanctioned — North Korea",
      category: "ofac",
      source: "ofac-sdn",
    });

    const result = await checkDestinationRisk(
      { destination: DEAD_ADDRESS, chain: "ethereum" },
      mockLookup,
    );

    expect(result.risk_level).toBe("CRITICAL");
    expect(result.flags.some((f) => f.type === "BLACKLIST")).toBe(true);
    expect(result.recommended_action).toBe("BLOCK");
  });

  it("test 6 — mixer category → CRITICAL MIXER with correct flags", async () => {
    const mockLookup: LabelLookupFn = vi.fn().mockResolvedValue({
      label: "Tornado Cash proxy",
      category: "mixer",
      source: "chainalysis",
    });

    const result = await checkDestinationRisk(
      { destination: DEAD_ADDRESS, chain: "ethereum" },
      mockLookup,
    );

    expect(result.risk_level).toBe("CRITICAL");
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0].type).toBe("MIXER");
    expect(result.flags[0].label).toBe("Tornado Cash proxy");
    expect(result.flags[0].source).toBe("chainalysis");
    expect(result.recommended_action).toBe("BLOCK");
  });
});
