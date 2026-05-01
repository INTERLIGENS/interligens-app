// src/lib/wallet-scan/engine.ts

export type WalletChain = "solana" | "ethereum" | "base" | "arbitrum";
export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export interface WalletScanInput {
  address: string;
  chain: WalletChain;
  _fetchFn?: typeof fetch;
}

export interface TokenHolding {
  mint: string;
  symbol: string;
  name: string;
  balanceFormatted: string;
  balanceUsd: number | null;
  riskLevel: RiskLevel;
  explorerUrl: string;
}

export interface WalletScanResult {
  address: string;
  chain: WalletChain;
  tokenCount: number;
  tokens: TokenHolding[];
  topRiskLevel: RiskLevel | "NONE";
  revokeRecommended: boolean;
  computed_at: string;
  error?: string;
}

// ── Risk scoring ──────────────────────────────────────────────────────────────

const KNOWN_SAFE = new Set([
  "SOL", "USDC", "USDT", "WETH", "WBTC", "ETH", "BTC",
  "JUP", "RAY", "ORCA", "BONK", "JTO", "WIF", "PYTH",
  "ARB", "OP", "DAI", "LINK", "UNI", "AAVE", "MKR",
  "CRV", "SNX", "COMP", "STRK", "BASE", "STETH", "RETH",
]);

const SCAM_PATTERN = /\b(rug|pump\.fun|dump|free\s*airdrop|claim\s*reward|100x|1000x)\b/i;

const RISK_ORDER: Array<RiskLevel | "NONE"> = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN", "NONE"];

export function scoreRisk(symbol: string, name: string, _balanceUsd: number | null): RiskLevel {
  if (!symbol && !name) return "UNKNOWN";
  if (SCAM_PATTERN.test(name) || SCAM_PATTERN.test(symbol)) return "CRITICAL";
  const sym = symbol.toUpperCase().trim();
  if (KNOWN_SAFE.has(sym)) return "LOW";
  if (!sym || sym.length > 20 || /^\d+$/.test(sym)) return "HIGH";
  return "UNKNOWN";
}

export function computeTopRiskLevel(tokens: TokenHolding[]): RiskLevel | "NONE" {
  if (!tokens.length) return "NONE";
  let best: RiskLevel | "NONE" = "NONE";
  for (const t of tokens) {
    if (RISK_ORDER.indexOf(t.riskLevel) < RISK_ORDER.indexOf(best)) best = t.riskLevel;
  }
  return best;
}

// ── Helius DAS (Solana) ───────────────────────────────────────────────────────

interface DasItem {
  id: string;
  interface?: string;
  token_info?: {
    symbol?: string;
    balance?: number;
    decimals?: number;
    price_info?: { total_price?: number };
  };
  content?: { metadata?: { name?: string; symbol?: string } };
}

async function scanSolana(address: string, fetchFn: typeof fetch): Promise<TokenHolding[]> {
  const key = process.env.HELIUS_API_KEY ?? "";
  if (!key) return [];
  try {
    const res = await fetchFn(
      `https://mainnet.helius-rpc.com/?api-key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getAssetsByOwner",
          params: {
            ownerAddress: address,
            page: 1,
            limit: 10,
            displayOptions: { showFungible: true },
          },
        }),
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { result?: { items?: DasItem[]; total?: number } };
    const items = (data.result?.items ?? []).filter(
      (i) => i.token_info !== undefined && (i.interface === "FungibleToken" || i.interface === "FungibleAsset"),
    );
    return items.slice(0, 10).filter((item) => {
      const sym = item.token_info?.symbol ?? item.content?.metadata?.symbol ?? "";
      return sym.trim().length > 0;
    }).map((item) => {
      const symbol =
        item.token_info?.symbol ?? item.content?.metadata?.symbol ?? "";
      const name = item.content?.metadata?.name ?? "";
      const decimals = item.token_info?.decimals ?? 0;
      const raw = item.token_info?.balance ?? 0;
      const balance = decimals > 0 ? raw / Math.pow(10, decimals) : raw;
      const balanceUsd = item.token_info?.price_info?.total_price ?? null;
      return {
        mint: item.id,
        symbol,
        name,
        balanceFormatted: balance.toLocaleString("en-US", { maximumFractionDigits: 4 }),
        balanceUsd,
        riskLevel: scoreRisk(symbol, name, balanceUsd),
        explorerUrl: `https://solscan.io/token/${item.id}`,
      };
    });
  } catch {
    return [];
  }
}

// ── Etherscan-compatible (EVM) ────────────────────────────────────────────────

const EVM_EXPLORER: Record<Exclude<WalletChain, "solana">, string> = {
  ethereum: "https://etherscan.io",
  base: "https://basescan.org",
  arbitrum: "https://arbiscan.io",
};

// Etherscan V2 uses a unified endpoint with chainid parameter
const EVM_CHAIN_ID: Record<Exclude<WalletChain, "solana">, number> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
};

interface EtherscanTx {
  contractAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
  value?: string;
  to?: string;
}

async function scanEvm(
  address: string,
  chain: Exclude<WalletChain, "solana">,
  fetchFn: typeof fetch,
): Promise<TokenHolding[]> {
  const key = process.env.ETHERSCAN_API_KEY ?? "";
  const chainId = EVM_CHAIN_ID[chain];
  const params = new URLSearchParams({
    chainid: String(chainId),
    module: "account",
    action: "tokentx",
    address,
    page: "1",
    offset: "50",
    sort: "desc",
    apikey: key || "YourApiKeyToken",
  });
  try {
    const res = await fetchFn(`https://api.etherscan.io/v2/api?${params.toString()}`, {
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      status: string;
      result?: EtherscanTx[];
    };
    if (data.status !== "1" || !Array.isArray(data.result)) return [];

    // Deduplicate by contract — keep first occurrence (most recent)
    const seen = new Set<string>();
    const unique: EtherscanTx[] = [];
    for (const t of data.result) {
      const contract = (t.contractAddress ?? "").toLowerCase();
      if (contract && !seen.has(contract)) {
        seen.add(contract);
        unique.push(t);
      }
    }

    return unique.slice(0, 10).map((t) => {
      const decimals = parseInt(t.tokenDecimal ?? "18", 10);
      const raw = Number(t.value ?? "0");
      const balance = raw / Math.pow(10, Math.min(decimals, 18));
      const symbol = t.tokenSymbol ?? "";
      const name = t.tokenName ?? "";
      return {
        mint: t.contractAddress,
        symbol,
        name,
        balanceFormatted: balance.toLocaleString("en-US", { maximumFractionDigits: 4 }),
        balanceUsd: null,
        riskLevel: scoreRisk(symbol, name, null),
        explorerUrl: `${EVM_EXPLORER[chain]}/token/${t.contractAddress}`,
      };
    });
  } catch {
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function computeWalletScan(
  input: WalletScanInput,
): Promise<WalletScanResult> {
  const fetchFn = input._fetchFn ?? fetch;
  const base: WalletScanResult = {
    address: input.address,
    chain: input.chain,
    tokenCount: 0,
    tokens: [],
    topRiskLevel: "NONE",
    revokeRecommended: false,
    computed_at: new Date().toISOString(),
  };
  try {
    const tokens =
      input.chain === "solana"
        ? await scanSolana(input.address, fetchFn)
        : await scanEvm(
            input.address,
            input.chain as Exclude<WalletChain, "solana">,
            fetchFn,
          );
    const topRiskLevel = computeTopRiskLevel(tokens);
    const revokeRecommended =
      input.chain !== "solana" &&
      (topRiskLevel === "CRITICAL" || topRiskLevel === "HIGH");
    return {
      ...base,
      tokenCount: tokens.length,
      tokens,
      topRiskLevel,
      revokeRecommended,
    };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
