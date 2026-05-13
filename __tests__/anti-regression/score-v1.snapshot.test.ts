/**
 * ANTI-REGRESSION — /api/v1/score response shape (Commit 14/15).
 *
 * Locks the full JSON body returned by GET /api/v1/score for 20 mints
 * (10 SOL + 10 EVM, covering top-cap, casefile-matched, mid-cap, and
 * synthetic edge cases). External data sources are mocked to fixed
 * values so the snapshot is deterministic; time is frozen.
 *
 * Verified via `git diff main..HEAD -- src/app/api/v1/score src/lib/caseDb
 * src/lib/marketProviders src/lib/tigerscore src/lib/entities/knownBad
 * src/lib/intelligence` (empty at Commit 14): REFLEX commits 1–7c did
 * not touch any of these, so the snapshots equal the main-branch
 * behaviour.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks must come BEFORE imports of the route handler ──────────────────

vi.mock("@/lib/publicScore/rateLimit", () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 99, resetIn: 60 }),
  getClientIp: () => "127.0.0.1",
  corsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/caseDb", () => ({ loadCaseByMint: vi.fn(() => null) }));
vi.mock("@/lib/marketProviders", () => ({ getMarketSnapshot: vi.fn() }));
vi.mock("@/lib/entities/knownBad", () => ({
  isKnownBadEvm: vi.fn(() => null),
}));
vi.mock("@/lib/intelligence", () => ({
  lookupValue: vi.fn(async () => ({
    ims: 0, ics: 0, matchCount: 0, hasSanction: false,
    topRiskClass: null, matchBasis: null, sourceSlug: null,
    externalUrl: null, winner: null,
  })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tokenScanAggregate: {
      upsert: vi.fn(async () => ({ communityScans: 1 })),
    },
  },
}));

import { getMarketSnapshot } from "@/lib/marketProviders";
import { loadCaseByMint } from "@/lib/caseDb";
import { isKnownBadEvm } from "@/lib/entities/knownBad";
import { GET as scoreV1GET } from "@/app/api/v1/score/route";
import { NextRequest } from "next/server";

const mockGetMarket = vi.mocked(getMarketSnapshot);
const mockLoadCase = vi.mocked(loadCaseByMint);
const mockIsKnownBadEvm = vi.mocked(isKnownBadEvm);

const FROZEN_DATE = new Date("2026-05-13T10:00:00.000Z");
const originalFetch = globalThis.fetch;

interface SolFixture {
  label: string;
  mint: string;
  market: {
    liquidity_usd: number | null;
    pair_age_days: number | null;
    fdv_usd: number | null;
    volume_24h_usd: number | null;
    url: string | null;
  };
  hasCasefile?: boolean;
}

const SOL_FIXTURES: SolFixture[] = [
  // 5 SOL top-cap
  { label: "SOL top-cap — USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    market: { liquidity_usd: 50_000_000, pair_age_days: 1200, fdv_usd: 50_000_000_000, volume_24h_usd: 200_000_000, url: "https://dex.example/usdc" } },
  { label: "SOL top-cap — wSOL", mint: "So11111111111111111111111111111111111111112",
    market: { liquidity_usd: 80_000_000, pair_age_days: 1800, fdv_usd: 60_000_000_000, volume_24h_usd: 500_000_000, url: "https://dex.example/wsol" } },
  { label: "SOL top-cap — USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    market: { liquidity_usd: 30_000_000, pair_age_days: 1500, fdv_usd: 40_000_000_000, volume_24h_usd: 100_000_000, url: "https://dex.example/usdt" } },
  { label: "SOL top-cap — JUP", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    market: { liquidity_usd: 4_000_000, pair_age_days: 365, fdv_usd: 1_500_000_000, volume_24h_usd: 15_000_000, url: "https://dex.example/jup" } },
  { label: "SOL top-cap — BONK", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    market: { liquidity_usd: 8_000_000, pair_age_days: 600, fdv_usd: 2_000_000_000, volume_24h_usd: 30_000_000, url: "https://dex.example/bonk" } },
  // 5 casefile (only BOTIFY has real data; rest are synthetic — loadCaseByMint
  // returns null for them, exercising the no_casefile branch).
  { label: "casefile — BOTIFY (real)", mint: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb",
    market: { liquidity_usd: 2_000, pair_age_days: 1, fdv_usd: 80_000, volume_24h_usd: 800_000, url: "https://pump.fun/coin/botify" },
    hasCasefile: true },
  { label: "casefile — RAVE (synthetic)", mint: "RaveTokenSynthetic111111111111111111111111ab",
    market: { liquidity_usd: 5_000, pair_age_days: 5, fdv_usd: 200_000, volume_24h_usd: 50_000, url: "https://pump.fun/coin/rave" } },
  { label: "casefile — GHOST (synthetic)", mint: "GhostTokenSynthetic11111111111111111111111ab",
    market: { liquidity_usd: 8_000, pair_age_days: 12, fdv_usd: 500_000, volume_24h_usd: 30_000, url: "https://pump.fun/coin/ghost" } },
  { label: "casefile — VINE (synthetic)", mint: "VineSynthetic1111111111111111111111111111aa",
    market: { liquidity_usd: 3_000, pair_age_days: 8, fdv_usd: 120_000, volume_24h_usd: 60_000, url: "https://pump.fun/coin/vine" } },
  // SOLAXY label kept for documentation; the address drops the 'l' since
  // base58 excludes lowercase L.
  { label: "casefile — SOLAXY (synthetic)", mint: "SoaxySynthetic1111111111111111111111111111aa",
    market: { liquidity_usd: 4_500, pair_age_days: 3, fdv_usd: 90_000, volume_24h_usd: 40_000, url: "https://pump.fun/coin/solaxy" } },
  // 3 SOL mid-cap (mid-cap fixtures #1-3 of 5)
  { label: "SOL mid-cap A", mint: "MidCapTokenA1111111111111111111111111111111A",
    market: { liquidity_usd: 800_000, pair_age_days: 200, fdv_usd: 15_000_000, volume_24h_usd: 1_000_000, url: "https://dex.example/midA" } },
  { label: "SOL mid-cap B", mint: "MidCapTokenB1111111111111111111111111111111B",
    market: { liquidity_usd: 400_000, pair_age_days: 90, fdv_usd: 8_000_000, volume_24h_usd: 600_000, url: "https://dex.example/midB" } },
  { label: "SOL mid-cap C", mint: "MidCapTokenC1111111111111111111111111111111C",
    market: { liquidity_usd: 1_500_000, pair_age_days: 300, fdv_usd: 20_000_000, volume_24h_usd: 2_000_000, url: "https://dex.example/midC" } },
];

interface EvmFixture {
  label: string;
  address: string;
  knownBad?: boolean;
}

const EVM_FIXTURES: EvmFixture[] = [
  // 5 EVM top-cap
  { label: "EVM top-cap — USDC ETH", address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
  { label: "EVM top-cap — USDT ETH", address: "0xdac17f958d2ee523a2206206994597c13d831ec7" },
  { label: "EVM top-cap — wBTC", address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599" },
  { label: "EVM top-cap — DAI", address: "0x6b175474e89094c44da98b954eedeac495271d0f" },
  { label: "EVM top-cap — LINK", address: "0x514910771af9ca656af840dff83e8264ecf986ca" },
  // 2 EVM mid-cap (mid-cap fixtures #4-5 of 5)
  { label: "EVM mid-cap — GordonGekko (known-bad)", address: "0xa5b0edf6b55128e0ddae8e51ac538c3188401d41", knownBad: true },
  { label: "EVM mid-cap — random EOA", address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_DATE);
  // Helius getAsset / getParsedAccountInfo / topHolderPct / graph all
  // resolve to 404 → SOL path picks up the no-supplementary-signal branch.
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({}), { status: 404 }),
  ) as unknown as typeof fetch;
  // Defaults — overridden per fixture below.
  mockLoadCase.mockReturnValue(null);
  mockIsKnownBadEvm.mockReturnValue(null);
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
});

describe.each(SOL_FIXTURES)("/api/v1/score snapshot — $label", (f) => {
  it("matches the locked response", async () => {
    mockGetMarket.mockResolvedValue({
      source: "dexscreener",
      primary_pool: "pool-1",
      dex: "raydium",
      url: f.market.url,
      price: 1,
      liquidity_usd: f.market.liquidity_usd,
      volume_24h_usd: f.market.volume_24h_usd,
      fdv_usd: f.market.fdv_usd,
      pair_age_days: f.market.pair_age_days,
      fetched_at: FROZEN_DATE.toISOString(),
      cache_hit: false,
    } as Awaited<ReturnType<typeof getMarketSnapshot>>);
    if (f.hasCasefile) {
      mockLoadCase.mockReturnValue({
        case_meta: {
          case_id: "CASE-2026-BOTIFY",
          status: "PUBLISHED",
          summary: "Test BOTIFY summary",
        },
        claims: [
          {
            claim_id: "C1", title: "Claim 1", severity: "CRITICAL",
            status: "CONFIRMED", description: "...", evidence_refs: [],
            thread_url: null, category: "OnChainProof",
          },
        ],
        sources: [],
      } as Awaited<ReturnType<typeof loadCaseByMint>>);
    }
    const req = new NextRequest(
      new Request(`http://localhost/api/v1/score?mint=${f.mint}`),
    );
    const res = await scoreV1GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchSnapshot();
  });
});

describe.each(EVM_FIXTURES)("/api/v1/score snapshot — $label", (f) => {
  it("matches the locked response", async () => {
    if (f.knownBad) {
      mockIsKnownBadEvm.mockReturnValue({
        address: f.address, chain: "ETH",
        label: "TestKnownBad", category: "scam", confidence: "high",
      });
    }
    const req = new NextRequest(
      new Request(`http://localhost/api/v1/score?mint=${f.address}`),
    );
    const res = await scoreV1GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchSnapshot();
  });
});
