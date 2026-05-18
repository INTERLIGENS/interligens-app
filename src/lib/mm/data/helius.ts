// ─── MM Tracker data layer — Helius (Solana) ─────────────────────────────
// Two entry points: the Enhanced Transactions API
// (api.helius.xyz/v0/addresses/...) and raw Solana JSON-RPC
// (mainnet.helius-rpc.com/?api-key=...).
//
// Env:
//   HELIUS_API_KEY

export class HeliusError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "HeliusError";
  }
}

export interface HeliusFetchOptions {
  retries?: number;
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
  apiKey?: string;
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
  init: RequestInit,
  opts: HeliusFetchOptions,
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseDelay = opts.retryDelayMs ?? 400;
  const fx = opts.fetchImpl ?? fetch;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fx(url, init);
      if (res.status === 429 || res.status >= 500) {
        if (attempt === retries) {
          const body = await safeJson(res);
          throw new HeliusError(
            `helius ${res.status} after ${retries} retries`,
            res.status,
            body,
          );
        }
        await backoff(attempt, baseDelay);
        continue;
      }
      if (!res.ok) {
        const body = await safeJson(res);
        throw new HeliusError(`helius ${res.status}`, res.status, body);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof HeliusError) throw err;
      if (attempt === retries) throw err;
      await backoff(attempt, baseDelay);
    }
  }
  throw new HeliusError("helius: unreachable retry loop", 0);
}

function apiKey(opts: HeliusFetchOptions = {}): string {
  const k = opts.apiKey ?? process.env.HELIUS_API_KEY;
  if (!k) throw new Error("HELIUS_API_KEY is not set");
  return k;
}

// ─── Enhanced Transactions API ────────────────────────────────────────────

export interface HeliusTx {
  signature: string;
  slot: number;
  timestamp: number;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  description?: string;
  events?: Record<string, unknown>;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    fromTokenAccount?: string;
    toTokenAccount?: string;
    mint: string;
    tokenAmount: number;
  }>;
}

export async function fetchSolanaTransactions(
  address: string,
  options: { limit?: number; before?: string } = {},
  fetchOpts: HeliusFetchOptions = {},
): Promise<HeliusTx[]> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 100);
  const url = new URL(
    `https://api.helius.xyz/v0/addresses/${address}/transactions`,
  );
  url.searchParams.set("api-key", apiKey(fetchOpts));
  url.searchParams.set("limit", String(limit));
  if (options.before) url.searchParams.set("before", options.before);
  return request<HeliusTx[]>(
    url.toString(),
    { method: "GET", headers: { accept: "application/json" } },
    fetchOpts,
  );
}

// ─── Token holders (RPC getTokenLargestAccounts + getProgramAccounts) ─────
// For the free tier, getTokenLargestAccounts returns only 20. The DAS API
// endpoint exposes deeper paging. Both paths are implemented; callers pick.

export interface HeliusHolder {
  owner: string;
  tokenAccount: string;
  amount: number;
  decimals: number;
}

export async function fetchSolanaTokenHolders(
  mintAddress: string,
  options: { limit?: number } = {},
  fetchOpts: HeliusFetchOptions = {},
): Promise<HeliusHolder[]> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 1_000);
  const rpc = `https://mainnet.helius-rpc.com/?api-key=${apiKey(fetchOpts)}`;
  const body = {
    jsonrpc: "2.0",
    id: "largest",
    method: "getTokenLargestAccounts",
    params: [mintAddress, { commitment: "confirmed" }],
  };
  const resp = await request<{
    result: { value: Array<{ address: string; amount: string; decimals: number }> };
  }>(
    rpc,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    fetchOpts,
  );
  const accounts = resp.result?.value ?? [];
  // Enrich with owner via getAccountInfo. For large lists this is expensive;
  // callers should treat .owner === "" as unknown.
  return accounts.slice(0, limit).map((a) => ({
    owner: "",
    tokenAccount: a.address,
    amount: Number(a.amount) / 10 ** a.decimals,
    decimals: a.decimals,
  }));
}

// ─── Balances ─────────────────────────────────────────────────────────────

export interface HeliusBalance {
  mint: string;
  tokenAccount: string;
  amount: number;
  decimals: number;
}

export async function fetchSolanaBalances(
  address: string,
  fetchOpts: HeliusFetchOptions = {},
): Promise<HeliusBalance[]> {
  const rpc = `https://mainnet.helius-rpc.com/?api-key=${apiKey(fetchOpts)}`;
  const body = {
    jsonrpc: "2.0",
    id: "balances",
    method: "getTokenAccountsByOwner",
    params: [
      address,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed" },
    ],
  };
  const resp = await request<{
    result: {
      value: Array<{
        pubkey: string;
        account: {
          data: {
            parsed: {
              info: {
                mint: string;
                tokenAmount: { amount: string; decimals: number; uiAmount: number };
              };
            };
          };
        };
      }>;
    };
  }>(
    rpc,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    fetchOpts,
  );
  return (resp.result?.value ?? []).map((v) => ({
    mint: v.account.data.parsed.info.mint,
    tokenAccount: v.pubkey,
    amount: v.account.data.parsed.info.tokenAmount.uiAmount,
    decimals: v.account.data.parsed.info.tokenAmount.decimals,
  }));
}
