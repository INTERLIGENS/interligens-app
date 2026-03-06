// src/lib/solanaGraph/expand.ts
import { HeliusTx, HopsDepth, DaysWindow } from "./types";
const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? "";
const HELIUS_API = "https://api.helius.xyz";
export const MAX_TX_PER_WALLET = 300;
export const MAX_HOP1 = 50;
export const MAX_HOP2 = 25;
const MAX_FETCH_PAGES = 3;
export interface ExpandStats { wallets_expanded_hop1: number; wallets_expanded_hop2: number; tx_fetched: number; }
export interface WalletTxData { address: string; hop: 1 | 2; txs: HeliusTx[]; counterparties: string[]; }
const KNOWN_PROGRAMS = new Set(["11111111111111111111111111111111","TokenkegQfeZyiNwAJbNbGKPFXCWuBvf8Ss623VQ5DA","ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bJo","ComputeBudget111111111111111111111111111111","MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr","srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX","675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8","9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP"]);
async function fetchEnhancedTxs(address: string, cutoffTs: number, maxTx = MAX_TX_PER_WALLET): Promise<HeliusTx[]> {
  const results: HeliusTx[] = []; let before: string | undefined;
  for (let page = 0; page < MAX_FETCH_PAGES; page++) {
    const url = new URL(`${HELIUS_API}/v0/addresses/${address}/transactions`);
    url.searchParams.set("api-key", HELIUS_API_KEY); url.searchParams.set("limit", "100");
    if (before) url.searchParams.set("before", before);
    try {
      const res = await fetch(url.toString()); if (!res.ok) break;
      const txs = await res.json() as HeliusTx[]; if (!txs.length) break;
      for (const tx of txs) { if (tx.timestamp < cutoffTs || results.length >= maxTx) break; results.push(tx); }
      const last = txs[txs.length - 1]; if (!last || last.timestamp < cutoffTs || results.length >= maxTx) break;
      before = last.signature;
    } catch (e) { console.error(`[expand] fetch failed for ${address}:`, e); break; }
  }
  return results;
}
function extractCounterparties(address: string, txs: HeliusTx[]): string[] {
  const seen = new Set<string>();
  for (const tx of txs) {
    for (const nt of tx.nativeTransfers ?? []) { const cp = nt.fromUserAccount === address ? nt.toUserAccount : nt.fromUserAccount; if (cp && cp !== address) seen.add(cp); }
    for (const tt of tx.tokenTransfers ?? []) { const cp = tt.fromUserAccount === address ? tt.toUserAccount : tt.fromUserAccount; if (cp && cp !== address) seen.add(cp); }
    for (const ad of tx.accountData ?? []) { if (ad.account !== address) seen.add(ad.account); }
  }
  return Array.from(seen).filter(cp => !KNOWN_PROGRAMS.has(cp));
}
export async function expandGraph(seedAddresses: string[], hops: HopsDepth, days: DaysWindow): Promise<{ walletData: Map<string, WalletTxData>; stats: ExpandStats }> {
  const cutoffTs = Math.floor(Date.now() / 1000) - days * 86400;
  const walletData = new Map<string, WalletTxData>();
  const stats: ExpandStats = { wallets_expanded_hop1: 0, wallets_expanded_hop2: 0, tx_fetched: 0 };
  await Promise.allSettled(seedAddresses.slice(0, MAX_HOP1).map(async addr => {
    const txs = await fetchEnhancedTxs(addr, cutoffTs); stats.tx_fetched += txs.length; stats.wallets_expanded_hop1++;
    walletData.set(addr, { address: addr, hop: 1, txs, counterparties: extractCounterparties(addr, txs) });
  }));
  if (hops === 1) return { walletData, stats };
  const hop2 = new Set<string>(); for (const [, d] of walletData) { for (const cp of d.counterparties) { if (!walletData.has(cp)) hop2.add(cp); } }
  await Promise.allSettled(Array.from(hop2).slice(0, MAX_HOP2).map(async addr => {
    const txs = await fetchEnhancedTxs(addr, cutoffTs, 100); stats.tx_fetched += txs.length; stats.wallets_expanded_hop2++;
    walletData.set(addr, { address: addr, hop: 2, txs, counterparties: extractCounterparties(addr, txs) });
  }));
  return { walletData, stats };
}
