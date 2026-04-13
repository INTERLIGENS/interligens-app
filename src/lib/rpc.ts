import { NextRequest } from "next/server";

// Simple in-memory RPC cache for Next.js serverless instance lifetime.
const RPC_CACHE = new Map<string, { t: number; v: any }>();
const TTL = 5 * 60 * 1000;

const RPC_ENDPOINTS: Record<string, string[]> = {
  ETH: [
    "https://ethereum.publicnode.com",
    "https://eth.drpc.org",
    "https://cloudflare-eth.com",
  ],
  BSC: ["https://bsc-dataseed1.binance.org", "https://bsc-dataseed2.binance.org"],
  SOL: ["https://api.mainnet-beta.solana.com", "https://rpc.ankr.com/solana"],
  BASE: ["https://mainnet.base.org", "https://base.drpc.org"],
  ARBITRUM: ["https://arb1.arbitrum.io/rpc", "https://arbitrum.drpc.org"],
};

export type RpcResult = {
  result: any;
  provider_used: string;
  cached: boolean;
  didFallback: boolean;
};

export async function rpcCall(
  chain: "ETH" | "BSC" | "SOL" | "BASE" | "ARBITRUM",
  method: string,
  params: any[]
): Promise<RpcResult> {
  const cacheKey = `${chain}:${method}:${JSON.stringify(params)}`;
  const hit = RPC_CACHE.get(cacheKey);
  if (hit && Date.now() - hit.t < TTL) {
    return {
      result: hit.v.result,
      provider_used: hit.v.provider,
      cached: true,
      didFallback: false,
    };
  }
  const endpoints = RPC_ENDPOINTS[chain] ?? [];
  let lastErr: any;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(4000),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      RPC_CACHE.set(cacheKey, {
        t: Date.now(),
        v: { result: data.result, provider: url },
      });
      return {
        result: data.result,
        provider_used: url,
        cached: false,
        didFallback: url !== endpoints[0],
      };
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw new Error(
    `rpcCall(${chain}, ${method}): all endpoints failed. Last: ${lastErr?.message}`
  );
}

// ───────────────────────────────────────────────────────────────────────────
// EVM minimum-viable coverage (ETH / Base / Arbitrum)
// ───────────────────────────────────────────────────────────────────────────

export type EvmChainKey = "ethereum" | "base" | "arbitrum";

export const EVM_CHAINS: Record<
  EvmChainKey,
  {
    id: number;
    name: string;
    rpc: string[];
    explorer: string;
    nativeSymbol: string;
    rpcCallKey: "ETH" | "BASE" | "ARBITRUM";
  }
> = {
  ethereum: {
    id: 1,
    name: "Ethereum",
    rpc: [
      process.env.ETH_RPC_URL || "https://ethereum.publicnode.com",
      "https://eth.drpc.org",
      "https://cloudflare-eth.com",
    ],
    explorer: "https://etherscan.io",
    nativeSymbol: "ETH",
    rpcCallKey: "ETH",
  },
  base: {
    id: 8453,
    name: "Base",
    rpc: [
      process.env.BASE_RPC_URL || "https://mainnet.base.org",
      "https://base.drpc.org",
    ],
    explorer: "https://basescan.org",
    nativeSymbol: "ETH",
    rpcCallKey: "BASE",
  },
  arbitrum: {
    id: 42161,
    name: "Arbitrum One",
    rpc: [
      process.env.ARB_RPC_URL || "https://arb1.arbitrum.io/rpc",
      "https://arbitrum.drpc.org",
    ],
    explorer: "https://arbiscan.io",
    nativeSymbol: "ETH",
    rpcCallKey: "ARBITRUM",
  },
};

export type EvmAccountInfo = {
  balance: string; // formatted ETH (18 decimals)
  balanceRaw: bigint;
  isContract: boolean;
  transactionCount: number;
  chain: EvmChainKey;
  chainId: number;
  explorerUrl: string;
  rpcDown: boolean;
  rpcFallbackUsed: boolean;
  cacheHit: boolean;
};

function formatEthFromWei(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n).toString().padStart(18, "0").slice(0, 6);
  return `${whole.toString()}.${frac}`;
}

function hexToBigInt(hex: string | null | undefined): bigint {
  if (!hex || typeof hex !== "string") return 0n;
  try {
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

async function jsonRpcFetch(
  url: string,
  method: string,
  params: unknown[],
  timeoutMs: number
): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (data.error) throw new Error(data.error.message || "rpc_error");
  return data.result;
}

/**
 * Unified EVM account lookup: balance + code + tx count via JSON-RPC.
 *
 * - 8s timeout per call
 * - In-memory cache (Map) TTL 5 minutes keyed by chain+address
 * - Endpoint fallback within a chain's RPC list
 * - Never throws: returns `{ rpcDown: true, ... }` with neutral values on failure
 */
export async function getEvmAccountInfo(
  address: string,
  chain: EvmChainKey
): Promise<EvmAccountInfo> {
  const chainCfg = EVM_CHAINS[chain];
  const cacheKey = `evm-account:${chain}:${address.toLowerCase()}`;
  const cachedEntry = RPC_CACHE.get(cacheKey);
  if (cachedEntry && Date.now() - cachedEntry.t < TTL) {
    return {
      ...(cachedEntry.v as EvmAccountInfo),
      cacheHit: true,
    };
  }

  const explorerUrl = `${chainCfg.explorer}/address/${address}`;
  const neutral: EvmAccountInfo = {
    balance: "0.000000",
    balanceRaw: 0n,
    isContract: false,
    transactionCount: 0,
    chain,
    chainId: chainCfg.id,
    explorerUrl,
    rpcDown: true,
    rpcFallbackUsed: false,
    cacheHit: false,
  };

  let rpcFallbackUsed = false;
  let providerUsed: string | null = null;

  for (let i = 0; i < chainCfg.rpc.length; i++) {
    const url = chainCfg.rpc[i];
    try {
      const [balRes, codeRes, txCountRes] = await Promise.all([
        jsonRpcFetch(url, "eth_getBalance", [address, "latest"], 8000),
        jsonRpcFetch(url, "eth_getCode", [address, "latest"], 8000),
        jsonRpcFetch(url, "eth_getTransactionCount", [address, "latest"], 8000),
      ]);

      const balanceRaw = hexToBigInt(balRes as string);
      const code = typeof codeRes === "string" ? codeRes : "0x";
      const isContract = code !== "0x" && code !== "0x0";
      const transactionCount = Number(hexToBigInt(txCountRes as string));

      providerUsed = url;
      rpcFallbackUsed = i > 0;

      const info: EvmAccountInfo = {
        balance: formatEthFromWei(balanceRaw),
        balanceRaw,
        isContract,
        transactionCount,
        chain,
        chainId: chainCfg.id,
        explorerUrl,
        rpcDown: false,
        rpcFallbackUsed,
        cacheHit: false,
      };

      RPC_CACHE.set(cacheKey, { t: Date.now(), v: info });
      return info;
    } catch (err) {
      // Try next endpoint.
      console.warn(
        `[getEvmAccountInfo] ${chain} ${url} failed:`,
        err instanceof Error ? err.message : String(err)
      );
      continue;
    }
  }

  // All endpoints failed — return neutral rpcDown result without throwing.
  // Cache it briefly so we don't hammer dead endpoints for the same address.
  RPC_CACHE.set(cacheKey, { t: Date.now(), v: neutral });
  return neutral;
}
