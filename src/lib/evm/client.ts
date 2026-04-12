/**
 * Generic EVM chain client — supports Etherscan v2 API (multi-chain).
 *
 * Chains: ETH, BSC, Base, Arbitrum.
 * Timeout 4s · returns null on failure (never throws) · works without API key (rate-limited).
 */

export interface EVMChainConfig {
  chainId: number;
  name: string;
  slug: string;
  apiBaseUrl: string;
  apiKeyEnvVar: string;
  nativeSymbol: string;
  nativeDecimals: number;
  rpcUrls: string[];
}

export const CHAINS: Record<string, EVMChainConfig> = {
  eth: {
    chainId: 1,
    name: "Ethereum",
    slug: "eth",
    apiBaseUrl: "https://api.etherscan.io/v2/api",
    apiKeyEnvVar: "ETHERSCAN_API_KEY",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    rpcUrls: ["https://eth.llamarpc.com", "https://rpc.ankr.com/eth"],
  },
  bsc: {
    chainId: 56,
    name: "BNB Chain",
    slug: "bsc",
    apiBaseUrl: "https://api.etherscan.io/v2/api",
    apiKeyEnvVar: "BSCSCAN_API_KEY",
    nativeSymbol: "BNB",
    nativeDecimals: 18,
    rpcUrls: ["https://bsc-dataseed1.binance.org", "https://bsc-dataseed2.binance.org"],
  },
  base: {
    chainId: 8453,
    name: "Base",
    slug: "base",
    apiBaseUrl: "https://api.etherscan.io/v2/api",
    apiKeyEnvVar: "BASESCAN_API_KEY",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    rpcUrls: ["https://mainnet.base.org", "https://rpc.ankr.com/base"],
  },
  arbitrum: {
    chainId: 42161,
    name: "Arbitrum One",
    slug: "arbitrum",
    apiBaseUrl: "https://api.etherscan.io/v2/api",
    apiKeyEnvVar: "ARBISCAN_API_KEY",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    rpcUrls: ["https://arb1.arbitrum.io/rpc", "https://rpc.ankr.com/arbitrum"],
  },
};

export function getChainConfig(chain: string): EVMChainConfig | null {
  return CHAINS[chain.toLowerCase()] ?? null;
}

export function isEVMAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

// ── Etherscan v2 API helper ──────────────────────────────────────────────────

function getApiKey(config: EVMChainConfig): string {
  // All Etherscan v2 chains can use the main ETHERSCAN_API_KEY
  const chainKey = process.env[config.apiKeyEnvVar] ?? "";
  if (chainKey) return chainKey;
  // Fallback to ETHERSCAN_API_KEY for v2 multi-chain support
  return process.env.ETHERSCAN_API_KEY ?? "";
}

export async function etherscanGet<T = any>(
  config: EVMChainConfig,
  module: string,
  action: string,
  params: Record<string, string> = {}
): Promise<T | null> {
  try {
    const apiKey = getApiKey(config);
    const qs = new URLSearchParams({
      chainid: String(config.chainId),
      module,
      action,
      ...(apiKey ? { apikey: apiKey } : {}),
      ...params,
    });
    const url = `${config.apiBaseUrl}?${qs.toString()}`;
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    const json = await res.json();
    return json as T;
  } catch {
    return null;
  }
}

// ── RPC helper ───────────────────────────────────────────────────────────────

export async function evmRpcCall(
  config: EVMChainConfig,
  method: string,
  params: any[]
): Promise<{ result: any; provider: string } | null> {
  for (const url of config.rpcUrls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(4000),
      });
      const data = await res.json();
      if (data.error) continue;
      return { result: data.result, provider: url };
    } catch {
      continue;
    }
  }
  return null;
}

// ── High-level helpers ───────────────────────────────────────────────────────

export async function isContract(
  config: EVMChainConfig,
  address: string
): Promise<boolean> {
  const rpc = await evmRpcCall(config, "eth_getCode", [address, "latest"]);
  if (!rpc) return false;
  return rpc.result !== "0x" && rpc.result !== "0x0";
}

export async function getBalance(
  config: EVMChainConfig,
  address: string
): Promise<string> {
  const resp = await etherscanGet<{ result: string }>(
    config, "account", "balance", { address, tag: "latest" }
  );
  return String((resp as any)?.result ?? "0");
}

export async function getTxList(
  config: EVMChainConfig,
  address: string,
  limit = 25
): Promise<any[]> {
  const resp = await etherscanGet<{ result: any[] }>(
    config, "account", "txlist",
    { address, startblock: "0", endblock: "99999999", page: "1", offset: String(limit), sort: "desc" }
  );
  return Array.isArray((resp as any)?.result) ? (resp as any).result : [];
}

export async function getSourceCode(
  config: EVMChainConfig,
  address: string
): Promise<any> {
  const resp = await etherscanGet(
    config, "contract", "getsourcecode", { address }
  );
  const arr = (resp as any)?.result;
  return Array.isArray(arr) ? arr[0] : {};
}
