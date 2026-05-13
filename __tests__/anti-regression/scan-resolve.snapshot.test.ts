/**
 * ANTI-REGRESSION — /api/scan/resolve response shape (Commit 14/15).
 *
 * Locks the merged Candidate[] response for 10 tickers. Each fixture
 * declares its own KolTokenLink / KolPromotionMention rows, and the
 * CoinGecko fetch is mocked. Source-rank merging logic stays under the
 * snapshot guard.
 *
 * Verified via `git diff main..HEAD -- src/app/api/scan/resolve`
 * (empty at Commit 14).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    kolTokenLink: { findMany: vi.fn() },
    kolPromotionMention: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET as resolveGET } from "@/app/api/scan/resolve/route";

const mockTokenLinkFindMany = vi.mocked(
  prisma.kolTokenLink.findMany as unknown as (...a: unknown[]) => unknown,
);
const mockMentionFindMany = vi.mocked(
  prisma.kolPromotionMention.findMany as unknown as (...a: unknown[]) => unknown,
);

interface Fixture {
  label: string;
  ticker: string;
  curated: Array<{ contractAddress: string; chain: string; tokenSymbol: string | null; kolHandle: string }>;
  mentions: Array<{ tokenMint: string; chain: string; tokenSymbol: string | null; kolHandle: string }>;
  coingecko?: Array<{ id: string; symbol: string; name: string; platforms?: Record<string, string> }>;
}

const FIXTURES: Fixture[] = [
  {
    label: "BTC — only coingecko",
    ticker: "BTC",
    curated: [], mentions: [],
    coingecko: [
      { id: "bitcoin", symbol: "btc", name: "Bitcoin", platforms: {} },
    ],
  },
  {
    label: "ETH — only coingecko (multi-platform)",
    ticker: "ETH",
    curated: [], mentions: [],
    coingecko: [
      {
        id: "ethereum", symbol: "eth", name: "Ethereum",
        platforms: { ethereum: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" },
      },
    ],
  },
  {
    label: "USDC — curated SOL (wins over coingecko)",
    ticker: "USDC",
    curated: [
      {
        contractAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        chain: "SOL", tokenSymbol: "USDC", kolHandle: "interligens",
      },
    ],
    mentions: [],
  },
  {
    label: "SOL — only coingecko",
    ticker: "SOL",
    curated: [], mentions: [],
    coingecko: [
      {
        id: "solana", symbol: "sol", name: "Solana",
        platforms: { solana: "So11111111111111111111111111111111111111112" },
      },
    ],
  },
  {
    label: "USDT — multiple curated across chains",
    ticker: "USDT",
    curated: [
      { contractAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        chain: "SOL", tokenSymbol: "USDT", kolHandle: "interligens" },
      { contractAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7",
        chain: "ETH", tokenSymbol: "USDT", kolHandle: "interligens" },
    ],
    mentions: [],
  },
  {
    label: "JUP — single curated SOL",
    ticker: "JUP",
    curated: [
      { contractAddress: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
        chain: "SOL", tokenSymbol: "JUP", kolHandle: "interligens" },
    ],
    mentions: [],
  },
  {
    label: "BONK — curated + mention overlap (curated wins)",
    ticker: "BONK",
    curated: [
      { contractAddress: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        chain: "SOL", tokenSymbol: "BONK", kolHandle: "interligens" },
    ],
    mentions: [
      { tokenMint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        chain: "SOL", tokenSymbol: "BONK", kolHandle: "randomkol" },
    ],
  },
  {
    label: "BOTIFY — mentions only",
    ticker: "BOTIFY",
    curated: [],
    mentions: [
      { tokenMint: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb",
        chain: "SOL", tokenSymbol: "BOTIFY", kolHandle: "donwedge" },
      { tokenMint: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb",
        chain: "SOL", tokenSymbol: "BOTIFY", kolHandle: "anotherkol" },
    ],
  },
  {
    label: "RAVE — mentions only",
    ticker: "RAVE",
    curated: [],
    mentions: [
      { tokenMint: "RaveTokenSynthetic111111111111111111111111ab",
        chain: "SOL", tokenSymbol: "RAVE", kolHandle: "kol1" },
    ],
  },
  {
    label: "NORESULT — no internal, coingecko empty",
    ticker: "NORESULT",
    curated: [], mentions: [], coingecko: [],
  },
];

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe.each(FIXTURES)("/api/scan/resolve snapshot — $label", (f) => {
  it("matches the locked response", async () => {
    mockTokenLinkFindMany.mockResolvedValue(f.curated);
    mockMentionFindMany.mockResolvedValue(
      f.mentions.map((m) => ({ ...m, kol: { handle: m.kolHandle } })),
    );
    // CoinGecko: two-step fetch (search → coins/{id}). Always return what
    // the fixture declares; if empty, search returns coins: [].
    globalThis.fetch = vi.fn(async (url) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/search?query=")) {
        return new Response(
          JSON.stringify({ coins: f.coingecko ?? [] }),
          { status: 200 },
        );
      }
      if (u.includes("/coins/")) {
        const id = u.split("/coins/")[1]?.split("?")[0];
        const found = (f.coingecko ?? []).find((c) => c.id === id);
        return new Response(
          JSON.stringify(found ?? { platforms: {} }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;

    const res = await resolveGET(
      new Request(`http://localhost/api/scan/resolve?ticker=${f.ticker}`) as unknown as Parameters<typeof resolveGET>[0],
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchSnapshot();
  });
});
