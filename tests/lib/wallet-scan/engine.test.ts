import { describe, it, expect, vi } from "vitest";
import {
  scoreRisk,
  computeTopRiskLevel,
  computeWalletScan,
  type TokenHolding,
} from "@/lib/wallet-scan/engine";

// ── Helpers ──────────────────────────────────────────────────────────────────

function ok(body: object) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function makeHeliusResponse(items: object[]) {
  return { result: { items, total: items.length } };
}

function makeEtherscanResponse(tokens: object[]) {
  return { status: "1", result: tokens };
}

// ── scoreRisk tests ───────────────────────────────────────────────────────────

describe("scoreRisk", () => {
  it("test 1 — known safe symbol → LOW", () => {
    expect(scoreRisk("USDC", "USD Coin", 1000)).toBe("LOW");
    expect(scoreRisk("SOL",  "Solana",   500)).toBe("LOW");
    expect(scoreRisk("WETH", "Wrapped ETH", null)).toBe("LOW");
  });

  it("test 2 — scam pattern in name → CRITICAL", () => {
    expect(scoreRisk("FREE", "free airdrop token", null)).toBe("CRITICAL");
    expect(scoreRisk("RUG",  "rug pull coin", 0)).toBe("CRITICAL");
    expect(scoreRisk("PUMP", "pump.fun clone", 100)).toBe("CRITICAL");
  });

  it("test 3 — empty symbol and name → UNKNOWN", () => {
    expect(scoreRisk("", "", null)).toBe("UNKNOWN");
    expect(scoreRisk("", "", 100)).toBe("UNKNOWN");
  });
});

// ── computeTopRiskLevel tests ─────────────────────────────────────────────────

describe("computeTopRiskLevel", () => {
  it("test 4 — mixed tokens → returns highest risk (CRITICAL)", () => {
    const tokens: TokenHolding[] = [
      { mint: "a", symbol: "SAFE", name: "Safe", balanceFormatted: "1", balanceUsd: 10, riskLevel: "LOW", explorerUrl: "" },
      { mint: "b", symbol: "??", name: "suspicious", balanceFormatted: "1", balanceUsd: 500, riskLevel: "CRITICAL", explorerUrl: "" },
      { mint: "c", symbol: "X", name: "unknown", balanceFormatted: "1", balanceUsd: null, riskLevel: "MEDIUM", explorerUrl: "" },
    ];
    expect(computeTopRiskLevel(tokens)).toBe("CRITICAL");
  });
});

// ── computeWalletScan integration tests ──────────────────────────────────────

describe("computeWalletScan", () => {
  it("test 5 — Solana scan with Helius mock → returns 2 tokens", async () => {
    const heliusItems = [
      {
        id: "MintAAAA1111111111111111111111111111111111",
        interface: "FungibleToken",
        token_info: { symbol: "BONK", balance: 1_000_000, decimals: 5, price_info: { total_price: 2.5 } },
        content: { metadata: { name: "Bonk", symbol: "BONK" } },
      },
      {
        id: "MintBBBB2222222222222222222222222222222222",
        interface: "FungibleToken",
        token_info: { symbol: "SCAM", balance: 100_000, decimals: 6, price_info: { total_price: 0.01 } },
        content: { metadata: { name: "free airdrop token", symbol: "SCAM" } },
      },
    ];
    const mockFetch = vi.fn(() => ok(makeHeliusResponse(heliusItems)));
    // Set env var for test
    process.env.HELIUS_API_KEY = "test-key";

    const result = await computeWalletScan({
      address: "WalletAddr1111111111111111111111111111111",
      chain: "solana",
      _fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.chain).toBe("solana");
    expect(result.tokens).toHaveLength(2);
    expect(result.tokens[0].symbol).toBe("BONK");
    expect(result.tokens[0].riskLevel).toBe("LOW");
    expect(result.tokens[1].riskLevel).toBe("CRITICAL");
    expect(result.topRiskLevel).toBe("CRITICAL");
    expect(result.revokeRecommended).toBe(false); // Solana never recommends revoke
  });

  it("test 6 — EVM scan with Etherscan mock → returns 2 tokens, revokeRecommended true", async () => {
    const ethTokens = [
      {
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        tokenName: "USD Coin",
        tokenSymbol: "USDC",
        tokenDecimal: "6",
        value: "1000000",
        to: "0x1234567890abcdef1234567890abcdef12345678",
      },
      {
        contractAddress: "0xDeadBeef000000000000000000000000DeadBeef",
        tokenName: "rug pull coin",
        tokenSymbol: "RUG",
        tokenDecimal: "18",
        value: "500000000000000000000",
        to: "0x1234567890abcdef1234567890abcdef12345678",
      },
    ];
    const mockFetch = vi.fn(() => ok(makeEtherscanResponse(ethTokens)));

    const result = await computeWalletScan({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      chain: "ethereum",
      _fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.chain).toBe("ethereum");
    expect(result.tokens).toHaveLength(2);
    expect(result.tokens[0].riskLevel).toBe("LOW");   // USDC
    expect(result.tokens[1].riskLevel).toBe("CRITICAL"); // rug pull
    expect(result.topRiskLevel).toBe("CRITICAL");
    expect(result.revokeRecommended).toBe(true);
  });
});
