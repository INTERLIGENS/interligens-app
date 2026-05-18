// ─── MM Tracker data layer — Birdeye ─────────────────────────────────────
// Multi-chain token/wallet data aggregator. Free-tier supports Solana and
// major EVMs. The API expects an X-API-KEY header.
//
// Env:
//   BIRDEYE_API_KEY (optional — if missing, every call throws a clear error
//   and the scanner degrades coverage gracefully).

import type { MmChain } from "../types";

const BASE = "https://public-api.birdeye.so";

const CHAIN_PARAM: Partial<Record<MmChain, string>> = {
  SOLANA: "solana",
  ETHEREUM: "ethereum",
  BASE: "base",
  ARBITRUM: "arbitrum",
  OPTIMISM: "optimism",
  BNB: "bsc",
  POLYGON: "polygon",
};

export class BirdeyeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "BirdeyeError";
  }
}

export interface BirdeyeFetchOptions {
  retries?: number;
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
  apiKey?: string;
}

function apiKey(opts: BirdeyeFetchOptions = {}): string {
  const k = opts.apiKey ?? process.env.BIRDEYE_API_KEY;
  if (!k) throw new Error("BIRDEYE_API_KEY is not set");
  return k;
}

function chainParam(chain: MmChain): string {
  const c = CHAIN_PARAM[chain];
  if (!c) throw new Error(`birdeye: chain ${chain} not supported`);
  return c;
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function backoff(attempt: number, base: number): Promise<void> {
  const delay = base * 2 ** attempt + Math.random() * 100;
  return new Promise((r) => setTimeout(r, delay));
}

async function request<T>(
  url: string,
  chain: MmChain,
  opts: BirdeyeFetchOptions,
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseDelay = opts.retryDelayMs ?? 400;
  const fx = opts.fetchImpl ?? fetch;
  const key = apiKey(opts);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fx(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          "X-API-KEY": key,
          "x-chain": chainParam(chain),
        },
      });
      if (res.status === 429 || res.status >= 500) {
        if (attempt === retries) {
          const body = await safeJson(res);
          throw new BirdeyeError(
            `birdeye ${res.status} after ${retries} retries`,
            res.status,
            body,
          );
        }
        await backoff(attempt, baseDelay);
        continue;
      }
      if (!res.ok) {
        const body = await safeJson(res);
        throw new BirdeyeError(`birdeye ${res.status}`, res.status, body);
      }
      const body = (await res.json()) as { success?: boolean; data?: T; message?: string };
      if (body.success === false) {
        throw new BirdeyeError(
          `birdeye logical error: ${body.message ?? "unknown"}`,
          200,
          body,
        );
      }
      return body.data as T;
    } catch (err) {
      if (err instanceof BirdeyeError) throw err;
      if (attempt === retries) throw err;
      await backoff(attempt, baseDelay);
    }
  }
  throw new BirdeyeError("birdeye: unreachable retry loop", 0);
}

// ─── Volume by wallet (for concentration detector) ────────────────────────

export interface BirdeyeVolumeByWallet {
  wallet: string;
  volumeUsd: number;
  buyUsd?: number;
  sellUsd?: number;
  txCount?: number;
}

export async function fetchTokenVolumeByWallet(
  tokenAddress: string,
  chain: MmChain,
  options: {
    timeFrom?: number;
    timeTo?: number;
    limit?: number;
  } = {},
  fetchOpts: BirdeyeFetchOptions = {},
): Promise<BirdeyeVolumeByWallet[]> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 1_000);
  const url = new URL(`${BASE}/defi/v3/token/trader/top`);
  url.searchParams.set("address", tokenAddress);
  url.searchParams.set("limit", String(limit));
  if (options.timeFrom) url.searchParams.set("time_from", String(options.timeFrom));
  if (options.timeTo) url.searchParams.set("time_to", String(options.timeTo));
  const raw = await request<{
    items?: Array<{
      owner?: string;
      wallet?: string;
      volume_usd?: number;
      volumeUsd?: number;
      buy_usd?: number;
      sell_usd?: number;
      tx_count?: number;
    }>;
  }>(url.toString(), chain, fetchOpts);
  const items = raw.items ?? [];
  return items
    .map((r) => ({
      wallet: r.owner ?? r.wallet ?? "",
      volumeUsd: r.volume_usd ?? r.volumeUsd ?? 0,
      buyUsd: r.buy_usd,
      sellUsd: r.sell_usd,
      txCount: r.tx_count,
    }))
    .filter((v) => v.wallet && v.volumeUsd > 0);
}

// ─── Price history (for priceAsymmetry + postListingPump) ────────────────

export interface BirdeyePricePoint {
  timestamp: number; // unix seconds
  priceUsd: number;
  volumeUsd: number;
}

export async function fetchTokenPriceHistory(
  tokenAddress: string,
  chain: MmChain,
  options: {
    timeFrom?: number;
    timeTo?: number;
    interval?: "1m" | "5m" | "15m" | "30m" | "1H" | "4H" | "1D";
  } = {},
  fetchOpts: BirdeyeFetchOptions = {},
): Promise<BirdeyePricePoint[]> {
  const url = new URL(`${BASE}/defi/history_price`);
  url.searchParams.set("address", tokenAddress);
  url.searchParams.set("address_type", "token");
  url.searchParams.set("type", options.interval ?? "1H");
  if (options.timeFrom) url.searchParams.set("time_from", String(options.timeFrom));
  if (options.timeTo) url.searchParams.set("time_to", String(options.timeTo));
  const raw = await request<{
    items?: Array<{ unixTime?: number; value?: number; volume?: number }>;
  }>(url.toString(), chain, fetchOpts);
  return (raw.items ?? []).map((p) => ({
    timestamp: p.unixTime ?? 0,
    priceUsd: p.value ?? 0,
    volumeUsd: p.volume ?? 0,
  }));
}

// ─── Top holders ──────────────────────────────────────────────────────────

export interface BirdeyeHolder {
  wallet: string;
  amount: number;
  percentage: number;
}

export async function fetchTopHolders(
  tokenAddress: string,
  chain: MmChain,
  limit = 50,
  fetchOpts: BirdeyeFetchOptions = {},
): Promise<BirdeyeHolder[]> {
  const url = new URL(`${BASE}/defi/v3/token/holder`);
  url.searchParams.set("address", tokenAddress);
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 1_000)));
  const raw = await request<{
    items?: Array<{
      owner?: string;
      wallet?: string;
      amount?: number;
      percentage?: number;
    }>;
  }>(url.toString(), chain, fetchOpts);
  return (raw.items ?? []).map((h) => ({
    wallet: h.owner ?? h.wallet ?? "",
    amount: h.amount ?? 0,
    percentage: h.percentage ?? 0,
  }));
}
