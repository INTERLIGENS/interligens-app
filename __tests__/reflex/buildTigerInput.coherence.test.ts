/**
 * REFLEX V1 — buildTigerInput coherence test.
 *
 * The constraint from the V1 spec: for each of 5 SOL mints and 5 EVM
 * addresses, the TigerScore obtained via the new helper must equal the
 * TigerScore obtained from /api/scan/solana or /api/scan/evm with the
 * same upstream data. If the two paths drift, this test fails — that
 * is the canary the user explicitly asked for.
 *
 * Strategy: mock the upstream data sources (RPC, market, casefile,
 * known-bad, intel, vault) at the module boundary. Both the helper AND
 * the imported route handler call the same mocks, so any divergence in
 * the composition logic surfaces as a score mismatch.
 *
 * For SOL the route does an internal HTTP fetch to /api/scan/solana/graph
 * for scam-lineage; we stub global fetch to fail that URL so both paths
 * see scam_lineage="NONE". The Helius metadata fetches likewise fail
 * cleanly — they don't feed the TigerScore composition.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────

vi.mock("@/lib/security/rateLimit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 99 })),
  rateLimitResponse: vi.fn(),
  getClientIp: () => "127.0.0.1",
  detectLocale: () => "en",
  RATE_LIMIT_PRESETS: { scan: {} },
}));

vi.mock("@/lib/rpc", () => ({ rpcCall: vi.fn() }));
vi.mock("@/lib/marketProviders", () => ({ getMarketSnapshot: vi.fn() }));
vi.mock("@/lib/caseDb", () => ({ loadCaseByMint: vi.fn() }));
vi.mock("@/lib/scoring", () => ({
  computeScore: vi.fn(() => ({
    score: 0,
    tier: "GREEN",
    breakdown: { base_score: 0, claim_penalty: 0, severity_multiplier: 1 },
    flags: [],
  })),
}));
vi.mock("@/lib/events/producer", () => ({ emitScanCompleted: vi.fn() }));
vi.mock("@/lib/vault/vaultLookup", () => ({
  vaultLookup: vi.fn(async () => ({ match: false, categories: [] })),
}));

vi.mock("@/lib/evm/chainDetect", () => ({
  detectActiveEvmChains: vi.fn(),
  detectAddressType: vi.fn(() => "evm"),
}));
vi.mock("@/lib/entities/knownBad", () => ({
  isKnownBadEvm: vi.fn(),
  getKnownBadGovernedStatus: vi.fn(() => null),
}));
vi.mock("@/lib/tigerscore/governedStatus", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/tigerscore/governedStatus")
  >("@/lib/tigerscore/governedStatus");
  return actual; // real logic — only data sources are mocked
});
vi.mock("@/lib/intelligence", () => ({
  lookupValue: vi.fn(async () => ({
    ims: 0,
    ics: 0,
    matchCount: 0,
    hasSanction: false,
    topRiskClass: null,
    matchBasis: null,
    sourceSlug: null,
    externalUrl: null,
    winner: null,
  })),
}));

import { rpcCall } from "@/lib/rpc";
import { getMarketSnapshot } from "@/lib/marketProviders";
import { loadCaseByMint } from "@/lib/caseDb";
import { detectActiveEvmChains } from "@/lib/evm/chainDetect";
import { isKnownBadEvm } from "@/lib/entities/knownBad";
import {
  computeTigerScore,
  computeTigerScoreWithIntel,
} from "@/lib/tigerscore/engine";

import { buildSolanaTigerInput } from "@/lib/scan/buildTigerInput/solana";
import { buildEvmTigerInput } from "@/lib/scan/buildTigerInput/evm";

import { GET as scanSolanaGET } from "@/app/api/scan/solana/route";
import { GET as scanEvmGET } from "@/app/api/scan/evm/route";
import { NextRequest } from "next/server";

const mockRpcCall = vi.mocked(rpcCall);
const mockGetMarketSnapshot = vi.mocked(getMarketSnapshot);
const mockLoadCaseByMint = vi.mocked(loadCaseByMint);
const mockDetectActiveEvmChains = vi.mocked(detectActiveEvmChains);
const mockIsKnownBadEvm = vi.mocked(isKnownBadEvm);

// ── Fixtures ──────────────────────────────────────────────────────────────

interface SolFixture {
  mint: string;
  label: string;
  liquidity_usd: number | null;
  pair_age_days: number | null;
  fdv_usd: number | null;
  volume_24h_usd: number | null;
  market_url: string | null;
}

const SOL_FIXTURES: SolFixture[] = [
  {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    label: "USDC SOL (deep liquidity)",
    liquidity_usd: 50_000_000, pair_age_days: 1200, fdv_usd: 50_000_000_000,
    volume_24h_usd: 200_000_000, market_url: "https://dex.example/usdc",
  },
  {
    mint: "So11111111111111111111111111111111111111112",
    label: "wSOL",
    liquidity_usd: 80_000_000, pair_age_days: 1800, fdv_usd: 60_000_000_000,
    volume_24h_usd: 500_000_000, market_url: "https://dex.example/wsol",
  },
  {
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    label: "BONK",
    liquidity_usd: 8_000_000, pair_age_days: 600, fdv_usd: 2_000_000_000,
    volume_24h_usd: 30_000_000, market_url: "https://dex.example/bonk",
  },
  {
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    label: "JUP (medium age)",
    liquidity_usd: 4_000_000, pair_age_days: 365, fdv_usd: 1_500_000_000,
    volume_24h_usd: 15_000_000, market_url: "https://dex.example/jup",
  },
  {
    mint: "PumpFunNewbie1111111111111111111111111111pump",
    label: "fresh pump-like token (low liquidity, young)",
    liquidity_usd: 5_000, pair_age_days: 1, fdv_usd: 50_000,
    volume_24h_usd: 100_000, market_url: "https://pump.fun/coin/x",
  },
];

interface EvmFixture {
  address: string;
  label: string;
  activeChains: ("ethereum" | "base" | "arbitrum")[];
  txCount: number;
  balanceRawWei: bigint;
  isContract: boolean;
  knownBad: boolean;
}

const EVM_FIXTURES: EvmFixture[] = [
  {
    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    label: "USDC ETH contract",
    activeChains: ["ethereum"], txCount: 1, balanceRawWei: 0n,
    isContract: true, knownBad: false,
  },
  {
    address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    label: "USDT ETH contract",
    activeChains: ["ethereum"], txCount: 1, balanceRawWei: 0n,
    isContract: true, knownBad: false,
  },
  {
    address: "0x4200000000000000000000000000000000000006",
    label: "Base wETH contract",
    activeChains: ["base"], txCount: 1, balanceRawWei: 0n,
    isContract: true, knownBad: false,
  },
  {
    address: "0xa5b0edf6b55128e0ddae8e51ac538c3188401d41",
    label: "GordonGekko (known-bad)",
    activeChains: ["ethereum", "base"], txCount: 250, balanceRawWei: 2n * 10n ** 18n,
    isContract: false, knownBad: true,
  },
  {
    address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    label: "fresh EOA with activity (Arbitrum primary)",
    activeChains: ["arbitrum"], txCount: 7, balanceRawWei: 5n * 10n ** 17n,
    isContract: false, knownBad: false,
  },
];

// ── Test setup ────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  // Stub global fetch: Helius getAsset / getParsedAccountInfo + the
  // /api/scan/solana/graph internal call all resolve to a 404 so both
  // paths see "no extra signal".
  globalThis.fetch = vi.fn(
    async () => new Response(JSON.stringify({}), { status: 404 }),
  ) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function applySolFixture(f: SolFixture) {
  mockRpcCall.mockResolvedValue({
    result: { value: { executable: false } },
    didFallback: false,
    provider_used: "helius_primary",
  } as Awaited<ReturnType<typeof rpcCall>>);
  mockLoadCaseByMint.mockReturnValue(null);
  mockGetMarketSnapshot.mockResolvedValue({
    source: "dexscreener",
    primary_pool: "pool-1",
    dex: "raydium",
    url: f.market_url,
    price: 1,
    liquidity_usd: f.liquidity_usd,
    volume_24h_usd: f.volume_24h_usd,
    fdv_usd: f.fdv_usd,
    pair_age_days: f.pair_age_days,
    fetched_at: new Date(2026, 4, 13).toISOString(),
    cache_hit: false,
  } as Awaited<ReturnType<typeof getMarketSnapshot>>);
}

function applyEvmFixture(f: EvmFixture) {
  const detail = (active: boolean) => ({
    balance: "0",
    balanceRaw: active ? f.balanceRawWei : 0n,
    isContract: active ? f.isContract : false,
    transactionCount: active ? f.txCount : 0,
    explorerUrl: "https://etherscan.io/address/" + f.address,
    rpcDown: false,
  });
  mockDetectActiveEvmChains.mockResolvedValue({
    activeChains: f.activeChains,
    details: {
      ethereum: detail(f.activeChains.includes("ethereum")),
      base: detail(f.activeChains.includes("base")),
      arbitrum: detail(f.activeChains.includes("arbitrum")),
    },
    allRpcDown: false,
  } as Awaited<ReturnType<typeof detectActiveEvmChains>>);
  mockIsKnownBadEvm.mockReturnValue(
    f.knownBad
      ? {
          address: f.address,
          chain: "ETH",
          label: "test-known-bad",
          category: "scam",
          confidence: "high",
        }
      : null,
  );
}

// ── SOL coherence ─────────────────────────────────────────────────────────

describe.each(SOL_FIXTURES)("SOL coherence — $label", (f) => {
  it("score(buildSolanaTigerInput) === score(/api/scan/solana response.tiger_score)", async () => {
    applySolFixture(f);

    // Helper path
    const tigerInput = await buildSolanaTigerInput(f.mint);
    const helperResult = computeTigerScore(tigerInput);

    // Route path
    const req = new NextRequest(
      new Request(`http://localhost/api/scan/solana?mint=${f.mint}`),
    );
    const res = await scanSolanaGET(req);
    expect(res.status).toBe(200);
    const routeJson = (await res.json()) as {
      tiger_score: number;
      tiger_tier: string;
    };

    expect(helperResult.score).toBe(routeJson.tiger_score);
    expect(helperResult.tier).toBe(routeJson.tiger_tier);
  });
});

// ── EVM coherence ─────────────────────────────────────────────────────────

describe.each(EVM_FIXTURES)("EVM coherence — $label", (f) => {
  it("finalScore(buildEvmTigerInput→withIntel) === /api/scan/evm response.tigerScore", async () => {
    applyEvmFixture(f);

    // Helper path
    const tigerInput = await buildEvmTigerInput(f.address);
    const helperResult = await computeTigerScoreWithIntel(tigerInput, f.address);

    // Route path
    const req = new NextRequest(
      new Request(`http://localhost/api/scan/evm?address=${f.address}`),
    );
    const res = await scanEvmGET(req);
    expect(res.status).toBe(200);
    const routeJson = (await res.json()) as {
      tigerScore: number;
      tier: string;
    };

    expect(helperResult.finalScore).toBe(routeJson.tigerScore);
    expect(helperResult.finalTier).toBe(routeJson.tier);
  });
});
