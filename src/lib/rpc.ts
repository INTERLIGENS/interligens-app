import { NextRequest } from "next/server";

const RPC_CACHE = new Map<string, { t: number; v: any }>();
const TTL = 5 * 60 * 1000;

const RPC_ENDPOINTS: Record<string, string[]> = {
  ETH: ["https://eth.llamarpc.com", "https://rpc.ankr.com/eth"],
  BSC: ["https://bsc-dataseed1.binance.org", "https://bsc-dataseed2.binance.org"],
  SOL: ["https://api.mainnet-beta.solana.com", "https://rpc.ankr.com/solana"],
};

export type RpcResult = { result: any; provider_used: string; cached: boolean; didFallback: boolean };

export async function rpcCall(chain: "ETH" | "BSC" | "SOL", method: string, params: any[]): Promise<RpcResult> {
  const cacheKey = `${chain}:${method}:${JSON.stringify(params)}`;
  const hit = RPC_CACHE.get(cacheKey);
  if (hit && Date.now() - hit.t < TTL) return { result: hit.v.result, provider_used: hit.v.provider, cached: true, didFallback: false };
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
      RPC_CACHE.set(cacheKey, { t: Date.now(), v: { result: data.result, provider: url } });
      return { result: data.result, provider_used: url, cached: false, didFallback: url !== endpoints[0] };
    } catch (e) { lastErr = e; continue; }
  }
  throw new Error(`rpcCall(${chain}, ${method}): all endpoints failed. Last: ${lastErr?.message}`);
}
