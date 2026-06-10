// src/lib/shill-correlation/wallet-profile.ts
// PHASE 4.6 — per-wallet activity profile via Helius, for autonomous bot/router
// vetting. Three cheap calls per wallet:
//   1. getSignaturesForAddress (RPC, limit 1000)  -> recent tx frequency
//   2. getTokenAccountsByOwner (via mm fetchSolanaBalances) -> token diversity
//   3. one enhanced-tx page (100)                 -> known-infra interactions
//
// Returns raw measurements only; classification/thresholds live in vetting.ts.

import { fetchSolanaBalances, fetchSolanaTransactions } from "@/lib/mm/data/helius";
import { KNOWN_INFRA_SET, infraLabel } from "./known-infra";

const HELIUS_RPC = () =>
  `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY ?? ""}`;

const THIRTY_DAYS_SEC = 30 * 24 * 3600;

export interface WalletProfile {
  wallet: string;
  txCount30d: number; // tx in trailing 30d (capped at the 1000-sig sample)
  sampleSize: number; // signatures actually returned (<=1000)
  sampleSaturated: boolean; // true if 1000 returned -> real count may be higher
  sampleSpanDays: number | null; // age span of the sample, days
  distinctTokenAccounts: number; // SPL token accounts currently held
  infraHits: string[]; // labels of known-infra addresses touched recently
  heliusCalls: number; // calls made (for credit accounting)
}

interface SigInfo {
  signature: string;
  blockTime: number | null;
}

async function getSignaturesForAddress(
  address: string,
  limit: number,
): Promise<SigInfo[]> {
  const res = await fetch(HELIUS_RPC(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "sigs",
      method: "getSignaturesForAddress",
      params: [address, { limit }],
    }),
  });
  if (!res.ok) throw new Error(`getSignaturesForAddress ${res.status}`);
  const json = (await res.json()) as {
    result?: Array<{ signature: string; blockTime: number | null }>;
  };
  return (json.result ?? []).map((r) => ({
    signature: r.signature,
    blockTime: r.blockTime ?? null,
  }));
}

/**
 * Build an activity profile for a wallet. `nowSec` is injected (callers pass
 * Math.floor(Date.now()/1000)) so this stays deterministic in tests.
 */
export async function fetchWalletProfile(
  wallet: string,
  nowSec: number,
): Promise<WalletProfile> {
  let heliusCalls = 0;

  // 1. recent signatures -> frequency
  const sigs = await getSignaturesForAddress(wallet, 1000);
  heliusCalls++;
  const cutoff = nowSec - THIRTY_DAYS_SEC;
  const timed = sigs.map((s) => s.blockTime).filter((t): t is number => t != null);
  const txCount30d = timed.filter((t) => t >= cutoff).length;
  const sampleSpanDays =
    timed.length >= 2
      ? (Math.max(...timed) - Math.min(...timed)) / 86400
      : null;

  // 2. token accounts held -> diversity
  let distinctTokenAccounts = 0;
  try {
    const balances = await fetchSolanaBalances(wallet);
    distinctTokenAccounts = balances.length;
  } catch {
    distinctTokenAccounts = -1; // unknown
  }
  heliusCalls++;

  // 3. recent enhanced txns -> known-infra interactions
  const infraHits = new Set<string>();
  try {
    const txs = await fetchSolanaTransactions(wallet, { limit: 100 });
    heliusCalls++;
    for (const t of txs) {
      const accts: Array<string | undefined> = [t.feePayer];
      for (const n of t.nativeTransfers ?? [])
        accts.push(n.fromUserAccount, n.toUserAccount);
      for (const tt of t.tokenTransfers ?? [])
        accts.push(tt.fromUserAccount, tt.toUserAccount);
      for (const a of accts) {
        if (a && KNOWN_INFRA_SET.has(a)) {
          const lbl = infraLabel(a);
          if (lbl) infraHits.add(lbl);
        }
      }
    }
  } catch {
    /* infra detection is best-effort */
  }

  return {
    wallet,
    txCount30d,
    sampleSize: sigs.length,
    sampleSaturated: sigs.length >= 1000,
    sampleSpanDays,
    distinctTokenAccounts,
    infraHits: [...infraHits],
    heliusCalls,
  };
}
