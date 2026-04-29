import { NextRequest, NextResponse } from "next/server";
import { loadCaseByMint } from "@/lib/caseDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0
export const fetchCache = 'force-no-store'

type Chain = "SOL" | "ETH" | "TRON" | "BSC" | "BASE" | "ARBITRUM";
type EntityType = "token" | "wallet";
type Confidence = "high" | "medium" | "low";

export interface TokenInfo {
  name: string | null;
  symbol: string | null;
  logoUrl: string | null;
  tokenAgeDays: number | null;
  address: string;
}

export interface MarketData {
  priceUsd: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
  source: "dexscreener" | "coingecko" | null;
}

export interface WalletInfo {
  label: string | null;
  linkedKOL: string | null;
  walletType: string | null;
  lastActivityAt: string | null;
}

export interface ScanContextResponse {
  target: string;
  chain: Chain;
  entityType: EntityType;
  tokenInfo: TokenInfo | null;
  marketData: MarketData | null;
  walletInfo: WalletInfo | null;
  missingFields: string[];
  confidence: Confidence;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

interface CacheEntry { data: ScanContextResponse; expiresAt: number }
const _cache = new Map<string, CacheEntry>();
const MARKET_TTL_MS =  60_000; // 60s — market data (shortest, drives TTL)
const WALLET_TTL_MS = 300_000; //  5min — wallet

function getCache(key: string): ScanContextResponse | null {
  const entry = _cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) { _cache.delete(key); return null; }
  return entry.data;
}

function setCache(key: string, data: ScanContextResponse, ttl: number) {
  _cache.set(key, { data, expiresAt: Date.now() + ttl });
}

// ─── Chain detection ──────────────────────────────────────────────────────────

function detectChain(address: string): Chain | null {
  const a = address.trim();
  if (!a) return null;
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return "TRON";
  if (/^bsc:0x[a-fA-F0-9]{40}$/i.test(a))      return "BSC";
  if (/^base:0x[a-fA-F0-9]{40}$/i.test(a))     return "BASE";
  if (/^arb:0x[a-fA-F0-9]{40}$/i.test(a))      return "ARBITRUM";
  if (/^0x[a-fA-F0-9]{40}$/i.test(a))          return "ETH";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return "SOL";
  return null;
}

function normalizeAddress(raw: string, chain: Chain): string {
  if (chain === "BSC")      return raw.replace(/^bsc:/i, "");
  if (chain === "BASE")     return raw.replace(/^base:/i, "");
  if (chain === "ARBITRUM") return raw.replace(/^arb:/i, "");
  return raw.trim();
}

const DEX_CHAIN: Record<Chain, string> = {
  SOL: "solana", ETH: "ethereum", BSC: "bsc",
  BASE: "base",  ARBITRUM: "arbitrum", TRON: "tron",
};

// ─── Enrichment ───────────────────────────────────────────────────────────────

interface HeliusMeta {
  name: string | null;
  symbol: string | null;
  logoUrl: string | null;
}

async function fetchHeliusMetadata(address: string): Promise<HeliusMeta | null> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://api.helius.xyz/v0/token-metadata?api-key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "interligens/1.0" },
        body: JSON.stringify({ mintAccounts: [address] }),
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const token = Array.isArray(json) ? json[0] : null;
    if (!token) return null;
    const onChain  = token.onChainMetadata?.metadata?.data ?? {};
    const offChain = token.offChainMetadata?.metadata      ?? {};
    const name   = onChain.name   ?? offChain.name   ?? null;
    const symbol = onChain.symbol ?? offChain.symbol ?? null;
    // Only return metadata if we have at least a name or symbol (real token signal)
    if (!name && !symbol) return null;
    return {
      name,
      symbol,
      logoUrl: offChain.image ?? token.offChainMetadata?.uri ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchDexScreener(address: string, chain: Chain) {
  try {
    const url = `https://api.dexscreener.com/tokens/v1/${DEX_CHAIN[chain]}/${address}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "interligens/1.0" },
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    // tokens/v1 returns a direct array; older /latest/dex/tokens wraps in { pairs: [] }
    const pairs: any[] = Array.isArray(json) ? json : (json?.pairs ?? []);
    if (pairs.length === 0) return null;
    const top = pairs[0];
    return {
      name:         top.baseToken?.name   ?? null,
      symbol:       top.baseToken?.symbol ?? null,
      logoUrl:      top.info?.imageUrl    ?? null,
      priceUsd:     top.priceUsd ? parseFloat(top.priceUsd) : null,
      marketCapUsd: top.marketCap ?? top.fdv             ?? null,
      volume24hUsd: top.volume?.h24                      ?? null,
      liquidityUsd: top.liquidity?.usd                   ?? null,
      pairCreatedAt: top.pairCreatedAt                   ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchCoinGeckoPrice(address: string, chain: Chain): Promise<number | null> {
  const CG_CHAIN: Partial<Record<Chain, string>> = {
    ETH: "ethereum", BSC: "binance-smart-chain",
    BASE: "base", ARBITRUM: "arbitrum-one", SOL: "solana",
  };
  const cgChain = CG_CHAIN[chain];
  if (!cgChain) return null;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${cgChain}/contract/${address}`,
      {
        headers: { Accept: "application/json", "User-Agent": "interligens/1.0" },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.market_data?.current_price?.usd ?? null;
  } catch {
    return null;
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("target")?.trim() ?? "";

  if (!target) {
    return NextResponse.json({ error: "target required" }, { status: 400 });
  }

  const chain = detectChain(target);
  if (!chain) {
    return NextResponse.json({ error: "Unrecognised address format" }, { status: 400 });
  }

  const address = normalizeAddress(target, chain);

  // TRON: address-only, no market data
  if (chain === "TRON") {
    const result: ScanContextResponse = {
      target, chain, entityType: "token",
      tokenInfo: { name: null, symbol: null, logoUrl: null, tokenAgeDays: null, address },
      marketData: null,
      walletInfo: null,
      missingFields: ["name", "symbol", "logoUrl", "price", "marketCap", "volume", "liquidity"],
      confidence: "low",
    };
    return NextResponse.json(result);
  }

  const cacheKey = `${chain}:${address}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });
  }

  // ── SOL: Helius is the primary token signal ───────────────────────────────
  // Helius returns metadata for mint accounts; wallets return null.
  // DexScreener runs in parallel for market data regardless.
  if (chain === "SOL") {
    const [heliusSettled, dexSettled] = await Promise.allSettled([
      fetchHeliusMetadata(address),
      fetchDexScreener(address, chain),
    ]);

    const helius = heliusSettled.status === "fulfilled" ? heliusSettled.value : null;
    const dex    = dexSettled.status    === "fulfilled" ? dexSettled.value    : null;

    // Fallback: static case DB (covers rugged tokens with burned on-chain metadata)
    const caseFile = (helius === null && dex === null) ? loadCaseByMint(address) : null;

    const isToken = helius !== null || dex !== null || caseFile !== null;

    if (!isToken) {
      const result: ScanContextResponse = {
        target, chain, entityType: "wallet",
        tokenInfo: null,
        marketData: null,
        walletInfo: { label: null, linkedKOL: null, walletType: null, lastActivityAt: null },
        missingFields: [],
        confidence: "low",
      };
      setCache(cacheKey, result, WALLET_TTL_MS);
      return NextResponse.json(result, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }

    const caseSymbol = caseFile?.case_meta.ticker?.replace(/^\$/, "") ?? null;
    const name    = helius?.name    ?? dex?.name    ?? caseFile?.case_meta.token_name ?? null;
    const symbol  = helius?.symbol  ?? dex?.symbol  ?? caseSymbol                    ?? null;
    const logoUrl = helius?.logoUrl ?? dex?.logoUrl ?? null;
    const tokenAgeDays = dex?.pairCreatedAt
      ? Math.floor((Date.now() - dex.pairCreatedAt) / 86_400_000)
      : null;

    let priceUsd     = dex?.priceUsd     ?? null;
    let marketCapUsd = dex?.marketCapUsd ?? null;
    let volume24hUsd = dex?.volume24hUsd ?? null;
    let liquidityUsd = dex?.liquidityUsd ?? null;
    let marketSource: "dexscreener" | "coingecko" | null = dex ? "dexscreener" : null;

    if (priceUsd === null) {
      priceUsd = await fetchCoinGeckoPrice(address, chain);
      if (priceUsd !== null) marketSource = "coingecko";
    }

    const missingFields: string[] = [];
    if (!name)             missingFields.push("name");
    if (!symbol)           missingFields.push("symbol");
    if (!logoUrl)          missingFields.push("logoUrl");
    if (priceUsd     === null) missingFields.push("price");
    if (marketCapUsd === null) missingFields.push("marketCap");
    if (volume24hUsd === null) missingFields.push("volume");
    if (liquidityUsd === null) missingFields.push("liquidity");
    if (tokenAgeDays === null) missingFields.push("tokenAgeDays");

    const filledCount = [name, symbol, priceUsd, marketCapUsd, volume24hUsd, liquidityUsd]
      .filter((v) => v !== null).length;
    const confidence: Confidence = filledCount >= 5 ? "high" : filledCount >= 3 ? "medium" : "low";

    const result: ScanContextResponse = {
      target, chain, entityType: "token",
      tokenInfo:  { name, symbol, logoUrl, tokenAgeDays, address },
      marketData: { priceUsd, marketCapUsd, volume24hUsd, liquidityUsd, source: marketSource },
      walletInfo: null,
      missingFields,
      confidence,
    };
    setCache(cacheKey, result, MARKET_TTL_MS);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  }

  // ── EVM chains: DexScreener is the token signal ───────────────────────────
  const dex = await fetchDexScreener(address, chain);
  const isToken = dex !== null;

  if (!isToken) {
    const result: ScanContextResponse = {
      target, chain, entityType: "wallet",
      tokenInfo: null,
      marketData: null,
      walletInfo: { label: null, linkedKOL: null, walletType: null, lastActivityAt: null },
      missingFields: [],
      confidence: "low",
    };
    setCache(cacheKey, result, WALLET_TTL_MS);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  }

  const name         = dex.name    ?? null;
  const symbol       = dex.symbol  ?? null;
  const logoUrl      = dex.logoUrl ?? null;
  const tokenAgeDays = dex.pairCreatedAt
    ? Math.floor((Date.now() - dex.pairCreatedAt) / 86_400_000)
    : null;

  let priceUsd     = dex.priceUsd     ?? null;
  let marketCapUsd = dex.marketCapUsd ?? null;
  let volume24hUsd = dex.volume24hUsd ?? null;
  let liquidityUsd = dex.liquidityUsd ?? null;
  let marketSource: "dexscreener" | "coingecko" | null = "dexscreener";

  if (priceUsd === null) {
    priceUsd = await fetchCoinGeckoPrice(address, chain);
    if (priceUsd !== null) marketSource = "coingecko";
  }

  const missingFields: string[] = [];
  if (!name)             missingFields.push("name");
  if (!symbol)           missingFields.push("symbol");
  if (!logoUrl)          missingFields.push("logoUrl");
  if (priceUsd     === null) missingFields.push("price");
  if (marketCapUsd === null) missingFields.push("marketCap");
  if (volume24hUsd === null) missingFields.push("volume");
  if (liquidityUsd === null) missingFields.push("liquidity");
  if (tokenAgeDays === null) missingFields.push("tokenAgeDays");

  const filledCount = [name, symbol, priceUsd, marketCapUsd, volume24hUsd, liquidityUsd]
    .filter((v) => v !== null).length;
  const confidence: Confidence = filledCount >= 5 ? "high" : filledCount >= 3 ? "medium" : "low";

  const result: ScanContextResponse = {
    target, chain, entityType: "token",
    tokenInfo:  { name, symbol, logoUrl, tokenAgeDays, address },
    marketData: { priceUsd, marketCapUsd, volume24hUsd, liquidityUsd, source: marketSource },
    walletInfo: null,
    missingFields,
    confidence,
  };
  setCache(cacheKey, result, MARKET_TTL_MS);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
