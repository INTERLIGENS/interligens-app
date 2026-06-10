// src/lib/shill-correlation/known-routers.ts
// PHASE 4.5 — static router/aggregator/CEX blacklist for the Shill Correlation
// Engine. These addresses appear as buyers across many shills MECHANICALLY
// (every user routing a swap through them), not as coordinated wallets, so they
// must never become correlation candidates. This fires regardless of cross-KOL
// spread (unlike the dormant genericSniperPenalty).
//
// CORRECTNESS RULE: a WRONG entry silently drops a real accomplice — far worse
// than a missing entry (which surfaces in manual review). So this list contains
// ONLY addresses we can stand behind. CEX hot wallets (Binance/Coinbase) and MM
// desks (Wintermute) are intentionally NOT guessed here — reliable static
// attribution isn't available without risk; they are deferred to PHASE 4.6
// (dynamic Helius labeled-entity enrichment).

export type RouterCategory =
  | "cex_router"
  | "dex_aggregator"
  | "amm_program"
  | "market_maker"
  | "mev_bot_known";

export interface KnownRouter {
  wallet: string;
  label: string;
  category: RouterCategory;
  sourceUrl: string;
}

export const KNOWN_ROUTERS: KnownRouter[] = [
  {
    // The false positive that motivated this filter: surfaced as a 5/5
    // "high_interest" candidate on dexsignals. Verified by manual review (David)
    // as the OKX swap router — every OKX user swapping any token routes through it.
    wallet: "ARu4n5mFdZogZAravu7CcizaojWnS6oqka37gdLT5SZn",
    label: "OKX Router",
    category: "cex_router",
    sourceUrl: "https://solscan.io/account/ARu4n5mFdZogZAravu7CcizaojWnS6oqka37gdLT5SZn",
  },
  {
    wallet: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    label: "Jupiter Aggregator v6",
    category: "dex_aggregator",
    sourceUrl: "https://solscan.io/account/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
  },
  {
    wallet: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    label: "Jupiter Aggregator v6 (secondary deployment)",
    category: "dex_aggregator",
    sourceUrl: "https://solscan.io/account/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  },
  {
    // Already trusted as a constant elsewhere in this repo (src/lib/kol/proceeds.ts).
    wallet: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    label: "Raydium Liquidity Pool AMM v4",
    category: "amm_program",
    sourceUrl: "https://solscan.io/account/675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  },
  {
    wallet: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
    label: "Pump.fun bonding-curve program",
    category: "amm_program",
    sourceUrl: "https://solscan.io/account/6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  },
];

/** O(1) membership set keyed by wallet address. */
export const KNOWN_ROUTERS_SET: ReadonlySet<string> = new Set(
  KNOWN_ROUTERS.map((r) => r.wallet),
);

/** Lookup the router metadata for a wallet, or undefined if not blacklisted. */
export function routerInfo(wallet: string): KnownRouter | undefined {
  return KNOWN_ROUTERS.find((r) => r.wallet === wallet);
}

export function isKnownRouter(wallet: string): boolean {
  return KNOWN_ROUTERS_SET.has(wallet);
}
