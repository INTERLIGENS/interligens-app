// ─── MM Tracker data layer — Etherscan v2 ────────────────────────────────
// Unified Etherscan v2 client with chainid param. Supports Ethereum (1),
// BASE (8453), Arbitrum (42161), Polygon (137), BNB (56), Optimism (10).
// Rate-limited at 5 rps, retries with exponential backoff on 429/5xx.
//
// Env:
//   ETHERSCAN_API_KEY — single key works across all v2-supported chains.

import type { MmChain } from "../types";

const V2_BASE = "https://api.etherscan.io/v2/api";

const CHAIN_IDS: Partial<Record<MmChain, number>> = {
  ETHEREUM: 1,
  BASE: 8453,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  BNB: 56,
  POLYGON: 137,
};

// ─── Rate limiter ─────────────────────────────────────────────────────────
// Token-bucket with capacity=5 and refill=5/sec. In a single process this is
// enough to stay under the Etherscan free tier (5 req/sec).

const bucket = { tokens: 5, lastRefill: Date.now() };

function refill(): void {
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1_000;
  const add = Math.floor(elapsed * 5);
  if (add > 0) {
    bucket.tokens = Math.min(5, bucket.tokens + add);
    bucket.lastRefill = now;
  }
}

async function take(): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    refill();
    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      return;
    }
    await new Promise((r) => setTimeout(r, 120));
  }
}

// ─── Retry with backoff ───────────────────────────────────────────────────

export interface EtherscanFetchOptions {
  retries?: number;
  retryDelayMs?: number;
  /** Override fetch (for tests). */
  fetchImpl?: typeof fetch;
  /** API key override (for tests). */
  apiKey?: string;
  /** Skip rate limiter in tests. */
  skipRateLimit?: boolean;
}

export class EtherscanError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "EtherscanError";
  }
}

export function chainIdOf(chain: MmChain): number {
  const id = CHAIN_IDS[chain];
  if (!id) throw new Error(`etherscan: chain ${chain} not supported`);
  return id;
}

async function request<T>(
  params: Record<string, string | number>,
  opts: EtherscanFetchOptions = {},
): Promise<T> {
  const apiKey = opts.apiKey ?? process.env.ETHERSCAN_API_KEY ?? "";
  if (!apiKey) throw new Error("ETHERSCAN_API_KEY is not set");

  const url = new URL(V2_BASE);
  url.searchParams.set("apikey", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const retries = opts.retries ?? 3;
  const baseDelay = opts.retryDelayMs ?? 400;
  const fx = opts.fetchImpl ?? fetch;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (!opts.skipRateLimit) await take();
    try {
      const res = await fx(url.toString(), {
        method: "GET",
        headers: { accept: "application/json" },
      });
      if (res.status === 429 || res.status >= 500) {
        if (attempt === retries) {
          const body = await safeJson(res);
          throw new EtherscanError(
            `etherscan ${res.status} after ${retries} retries`,
            res.status,
            body,
          );
        }
        await backoff(attempt, baseDelay);
        continue;
      }
      if (!res.ok) {
        const body = await safeJson(res);
        throw new EtherscanError(`etherscan ${res.status}`, res.status, body);
      }
      const body = (await res.json()) as { status?: string; message?: string; result?: T };
      // Etherscan returns HTTP 200 with `status: "0"` for empty / error result.
      if (body.status === "0" && body.message === "No transactions found") {
        return [] as unknown as T;
      }
      if (body.status === "0") {
        throw new EtherscanError(
          `etherscan logical error: ${body.message ?? "unknown"}`,
          200,
          body,
        );
      }
      return body.result as T;
    } catch (err) {
      if (err instanceof EtherscanError) throw err;
      if (attempt === retries) throw err;
      await backoff(attempt, baseDelay);
    }
  }
  // unreachable
  throw new EtherscanError("etherscan: unreachable retry loop", 0);
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

// ─── Public API ───────────────────────────────────────────────────────────

export interface EtherscanTx {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gasUsed: string;
  isError: string;
  input: string;
  contractAddress?: string;
  methodId?: string;
}

export interface EtherscanTokenTx extends EtherscanTx {
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
}

export interface EtherscanBalance {
  balanceWei: string;
  balanceEth: number;
}

export async function fetchWalletTransactions(
  address: string,
  chain: MmChain,
  options: {
    startBlock?: number;
    endBlock?: number;
    limit?: number;
  } = {},
  fetchOpts: EtherscanFetchOptions = {},
): Promise<EtherscanTx[]> {
  const limit = Math.min(Math.max(options.limit ?? 1_000, 1), 10_000);
  return request<EtherscanTx[]>(
    {
      chainid: chainIdOf(chain),
      module: "account",
      action: "txlist",
      address,
      startblock: options.startBlock ?? 0,
      endblock: options.endBlock ?? 99_999_999,
      page: 1,
      offset: limit,
      sort: "desc",
    },
    fetchOpts,
  );
}

export async function fetchTokenTransfers(
  address: string,
  chain: MmChain,
  tokenAddress?: string,
  options: { limit?: number } = {},
  fetchOpts: EtherscanFetchOptions = {},
): Promise<EtherscanTokenTx[]> {
  const limit = Math.min(Math.max(options.limit ?? 1_000, 1), 10_000);
  const params: Record<string, string | number> = {
    chainid: chainIdOf(chain),
    module: "account",
    action: "tokentx",
    address,
    page: 1,
    offset: limit,
    sort: "desc",
    startblock: 0,
    endblock: 99_999_999,
  };
  if (tokenAddress) params.contractaddress = tokenAddress;
  return request<EtherscanTokenTx[]>(params, fetchOpts);
}

export async function fetchWalletBalance(
  address: string,
  chain: MmChain,
  fetchOpts: EtherscanFetchOptions = {},
): Promise<EtherscanBalance> {
  const balanceWei = await request<string>(
    {
      chainid: chainIdOf(chain),
      module: "account",
      action: "balance",
      address,
      tag: "latest",
    },
    fetchOpts,
  );
  return {
    balanceWei,
    balanceEth: Number(balanceWei) / 1e18,
  };
}
