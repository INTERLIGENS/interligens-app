// ─── Canonical token resolution service ────────────────────────────────────
// THE single ticker/CA → canonical token resolver. Three consumers (scan,
// watcher-bridge, retail-upload) call this so there is never a second
// ticker→CA logic. READ-ONLY: hits DexScreener + Solana RPC (Helius). No DB
// write, no DB read this sprint.
//
// Deterministic confidence hierarchy (strict order):
//   L1 explicit CA in post (base58-valid + DexScreener OR RPC confirmed) → HIGH
//   L2 cashtag, single plausible DexScreener exact                       → HIGH
//   L3 multiple candidates / generic / prefix-only                       → AMBIGUOUS
//   L4 CA present but resolves to a different token than the cashtag      → CONFLICT
// GOLDEN RULE: never HIGH when more than one plausible candidate remains;
// when in doubt → AMBIGUOUS, never RESOLVED.

import {
  searchDexScreenerPairs,
  normalizeSymbol,
  tickerMatchType,
} from "@/lib/marketProviders";
import { extractValidSolanaMints } from "./normalizeSolanaMint";
import {
  decideCashtag,
  toTokenCandidate,
  type TokenCandidate,
  type Confidence,
} from "./scoreTokenCandidate";

export interface ResolveCanonicalInput {
  rawText?: string;
  extractedCashtags?: string[];
  extractedAddresses?: string[];
  chainHint?: "solana" | "ethereum" | "base" | null;
  postTimestamp?: Date;
  kolHandle?: string;
  watcherCampaignId?: string;
}

export type ResolutionStatus = "RESOLVED" | "AMBIGUOUS" | "UNRESOLVED" | "CONFLICT";
export type ResolutionMethod =
  | "explicit_ca"
  | "dexscreener_exact"
  | "dexscreener_ranked"
  | "manual"
  | "none";

export interface CanonicalTokenResolution {
  status: ResolutionStatus;
  chain?: string;
  canonicalMint?: string;
  symbol?: string;
  name?: string;
  confidence: Confidence;
  method: ResolutionMethod;
  candidates: TokenCandidate[];
  limitations: string[];
}

// Built lazily (read env at call time, not module load) so the key is always
// the live one regardless of import ordering.
const heliusRpcUrl = () =>
  `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY ?? ""}`;

interface MintMarket {
  symbol: string;
  name: string | null;
  mint: string;
  chain: string;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
}

// DexScreener token-by-mint → the most-liquid SOL pair for that exact mint, or
// null when the mint is not indexed (new / illiquid pump.fun token).
async function dexScreenerByMint(mint: string): Promise<MintMarket | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const pairs: any[] = Array.isArray(json) ? json : json?.pairs ?? [];
    const sol = pairs
      .filter((p) => p?.chainId === "solana" && p?.baseToken?.address === mint)
      .sort((a, b) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0));
    const top = sol[0];
    if (!top) return null;
    return {
      symbol: String(top.baseToken?.symbol ?? "").replace(/^\$+/, "").toUpperCase(),
      name: top.baseToken?.name ?? null,
      mint,
      chain: "SOL",
      liquidityUsd: typeof top.liquidity?.usd === "number" ? top.liquidity.usd : null,
      volume24hUsd: typeof top.volume?.h24 === "number" ? top.volume.h24 : null,
    };
  } catch {
    return null;
  }
}

// Solana RPC fallback (Helius): confirm a mint account exists on-chain. Used
// only when DexScreener has no pair yet — a freshly launched pump.fun token
// exists on-chain before it is indexed.
async function rpcConfirmMint(mint: string): Promise<boolean> {
  if (!process.env.HELIUS_API_KEY) return false;
  try {
    const res = await fetch(heliusRpcUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [mint, { encoding: "jsonParsed" }],
      }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    // parsed.type === "mint" confirms it is a token mint (SPL or Token-2022).
    return json?.result?.value?.data?.parsed?.type === "mint";
  } catch {
    return false;
  }
}

function explicitCandidate(m: MintMarket): TokenCandidate {
  return {
    chain: m.chain,
    mint: m.mint,
    symbol: m.symbol,
    name: m.name,
    liquidityUsd: m.liquidityUsd,
    volume24hUsd: m.volume24hUsd,
    matchType: "explicit_ca",
    source: "explicit_ca",
  };
}

export async function resolveCanonicalToken(
  input: ResolveCanonicalInput,
): Promise<CanonicalTokenResolution> {
  const limitations: string[] = [];
  const cashtags = (input.extractedCashtags ?? []).filter(Boolean);
  const firstCashtag = cashtags[0];

  // ─── Level 1 — explicit CA in the post ──────────────────────────────────
  const validMints = extractValidSolanaMints(input.extractedAddresses);
  if ((input.extractedAddresses?.length ?? 0) > 0 && validMints.length === 0) {
    limitations.push("address(es) present but none are valid base58 Solana mints");
  }

  for (const mint of validMints) {
    const dex = await dexScreenerByMint(mint);

    if (dex) {
      // CA confirmed on DexScreener (symbol known) → check Level-4 CONFLICT.
      if (firstCashtag) {
        const cashN = normalizeSymbol(firstCashtag);
        const caN = normalizeSymbol(dex.symbol);
        const symbolsAgree = !!cashN && !!caN && tickerMatchType(cashN, caN) !== null;
        if (cashN && !symbolsAgree) {
          const cashHits = await searchDexScreenerPairs(firstCashtag);
          const otherPlausible = cashHits.filter(
            (h) =>
              h.matchType === "exact" &&
              h.chain === "SOL" &&
              !h.lowLiquidity &&
              h.mint !== mint,
          );
          if (otherPlausible.length > 0) {
            return {
              status: "CONFLICT",
              confidence: "LOW",
              method: "explicit_ca",
              chain: dex.chain,
              canonicalMint: mint,
              symbol: dex.symbol,
              name: dex.name ?? undefined,
              candidates: [explicitCandidate(dex), ...otherPlausible.map(toTokenCandidate)],
              limitations: [
                ...limitations,
                `post CA resolves to $${dex.symbol} but cashtag $${firstCashtag.replace(/^\$+/, "")} matches a different token — manual review required`,
              ],
            };
          }
        }
      }
      // No conflict → resolved on the explicit CA.
      return {
        status: "RESOLVED",
        confidence: "HIGH",
        method: "explicit_ca",
        chain: dex.chain,
        canonicalMint: mint,
        symbol: dex.symbol,
        name: dex.name ?? undefined,
        candidates: [explicitCandidate(dex)],
        limitations,
      };
    }

    // No DexScreener pair → RPC fallback (on-chain existence).
    const onChain = await rpcConfirmMint(mint);
    if (onChain) {
      return {
        status: "RESOLVED",
        confidence: "HIGH",
        method: "explicit_ca",
        chain: "SOL",
        canonicalMint: mint,
        symbol: undefined,
        name: undefined,
        candidates: [
          {
            chain: "SOL",
            mint,
            symbol: "",
            name: null,
            liquidityUsd: null,
            volume24hUsd: null,
            matchType: "explicit_ca",
            source: "explicit_ca",
          },
        ],
        limitations: [
          ...limitations,
          "CA confirmed on-chain via RPC; no DexScreener pair yet (new/illiquid) — symbol & market data unavailable, cashtag conflict check skipped",
        ],
      };
    }

    limitations.push(`valid base58 mint ${mint.slice(0, 8)}… not confirmed on DexScreener or RPC`);
  }

  // ─── Level 2/3 — cashtag via DexScreener ────────────────────────────────
  if (firstCashtag) {
    const hits = await searchDexScreenerPairs(firstCashtag);
    const d = decideCashtag(firstCashtag, hits);
    const candidates = d.candidates.map(toTokenCandidate);
    if (d.status === "RESOLVED" && d.winner) {
      return {
        status: "RESOLVED",
        confidence: d.confidence,
        method: d.method,
        chain: d.winner.chain,
        canonicalMint: d.winner.mint,
        symbol: d.winner.ticker,
        name: d.winner.name ?? undefined,
        candidates,
        limitations: [...limitations, ...d.limitations],
      };
    }
    return {
      status: d.status,
      confidence: d.confidence,
      method: d.status === "UNRESOLVED" ? "none" : d.method,
      candidates,
      limitations: [...limitations, ...d.limitations],
    };
  }

  // ─── Nothing actionable ─────────────────────────────────────────────────
  return {
    status: "UNRESOLVED",
    confidence: "LOW",
    method: "none",
    candidates: [],
    limitations: [...limitations, "no valid CA and no cashtag to resolve"],
  };
}
