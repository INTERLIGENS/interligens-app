/**
 * Alchemy token balance fetcher for EVM wallet scan.
 * Single call to alchemy_getTokenBalances replaces N tokentx + N tokenbalance calls.
 * Fallback to Etherscan if ALCHEMY_API_KEY is absent.
 */

import { scoreRisk, type TokenHolding, type WalletChain } from "@/lib/wallet-scan/engine";

type EVMChain = Exclude<WalletChain, "solana">;

const ALCHEMY_HOST: Record<EVMChain, string> = {
  ethereum: "eth-mainnet.g.alchemy.com",
  base: "base-mainnet.g.alchemy.com",
  arbitrum: "arb-mainnet.g.alchemy.com",
};

const EVM_EXPLORER: Record<EVMChain, string> = {
  ethereum: "https://etherscan.io",
  base: "https://basescan.org",
  arbitrum: "https://arbiscan.io",
};

interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string; // hex string
}

interface AlchemyTokenMetadata {
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  logo: string | null;
}

async function alchemyPost<T>(
  host: string,
  apiKey: string,
  method: string,
  params: unknown[],
  fetchFn: typeof fetch,
): Promise<T | null> {
  try {
    const res = await fetchFn(`https://${host}/v2/${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.result ?? null;
  } catch {
    return null;
  }
}

export async function getTokenBalancesAlchemy(
  address: string,
  chain: EVMChain,
  fetchFn: typeof fetch = fetch,
): Promise<TokenHolding[] | null> {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) return null;

  const host = ALCHEMY_HOST[chain];
  const explorer = EVM_EXPLORER[chain];

  // Single call — all ERC-20 balances at once
  const balResult = await alchemyPost<{ tokenBalances: AlchemyTokenBalance[] }>(
    host, apiKey,
    "alchemy_getTokenBalances",
    [address, "erc20"],
    fetchFn,
  );
  if (!balResult) return null;

  const nonZero = balResult.tokenBalances.filter(
    (b) => b.tokenBalance && b.tokenBalance !== "0x0000000000000000000000000000000000000000000000000000000000000000",
  );

  if (nonZero.length === 0) return [];

  // Batch metadata — max 10 in parallel, process in chunks
  const CHUNK = 10;
  const holdings: TokenHolding[] = [];

  for (let i = 0; i < nonZero.length; i += CHUNK) {
    const chunk = nonZero.slice(i, i + CHUNK);
    const metaResults = await Promise.all(
      chunk.map((b) =>
        alchemyPost<AlchemyTokenMetadata>(
          host, apiKey,
          "alchemy_getTokenMetadata",
          [b.contractAddress],
          fetchFn,
        ),
      ),
    );

    for (let j = 0; j < chunk.length; j++) {
      const b = chunk[j];
      const meta = metaResults[j];
      const decimals = meta?.decimals ?? 18;
      const rawHex = b.tokenBalance;
      const raw = BigInt(rawHex);
      if (raw === 0n) continue;

      const balance = Number(raw) / Math.pow(10, Math.min(decimals, 18));
      const symbol = meta?.symbol ?? "";
      const name = meta?.name ?? "";

      holdings.push({
        mint: b.contractAddress,
        symbol,
        name,
        balanceFormatted: balance.toLocaleString("en-US", { maximumFractionDigits: 4 }),
        balanceUsd: null,
        riskLevel: scoreRisk(symbol, name, null),
        explorerUrl: `${explorer}/token/${b.contractAddress}`,
      });
    }
  }

  return holdings;
}
