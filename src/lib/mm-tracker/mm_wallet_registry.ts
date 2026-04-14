/**
 * MM Wallet Registry — V1
 *
 * Static list of wallets attributed to known market-making desks
 * (Wintermute, Jump Trading, DWF Labs, GSR, etc.).
 *
 * INTENTIONALLY EMPTY at V1. See src/lib/mm-tracker/README.md for the
 * sourcing checklist and attribution criteria before adding entries.
 * Every entry must have a verifiable public source logged in `source`.
 */

export type MMDesk =
  | "WINTERMUTE"
  | "JUMP"
  | "DWF"
  | "GSR"
  | "FLOWDESK"
  | "B2C2"
  | "CUMBERLAND"
  | "UNKNOWN";

export type MMChain = "SOL" | "ETH" | "BASE" | "ARBITRUM" | "BSC";

export interface MMWalletEntry {
  address: string;
  chain: MMChain;
  desk: MMDesk;
  label: string;
  /** Verifiable public source for the attribution (URL / dataset name). */
  source: string;
  /** HIGH: on-chain label or desk-confirmed. MEDIUM: repeated press mentions. LOW: inferred. */
  confidence: "HIGH" | "MEDIUM" | "LOW";
  addedAt: string; // ISO date
}

/**
 * V1: empty on purpose. Populate from the audit checklist in README.md.
 * Never inline addresses from single-tweet claims — require ≥2 independent
 * sources or an on-chain label from Arkham / Etherscan / Nansen.
 */
export const MM_WALLETS: MMWalletEntry[] = [];

function normalizeAddress(chain: MMChain, address: string): string {
  if (chain === "SOL") return address.trim();
  return address.trim().toLowerCase();
}

export function findMMWallet(chain: MMChain, address: string): MMWalletEntry | null {
  const needle = normalizeAddress(chain, address);
  for (const w of MM_WALLETS) {
    if (w.chain !== chain) continue;
    if (normalizeAddress(w.chain, w.address) === needle) return w;
  }
  return null;
}

export function listDeskWallets(chain: MMChain, desk: MMDesk): MMWalletEntry[] {
  return MM_WALLETS.filter((w) => w.chain === chain && w.desk === desk);
}

/** True if at least one wallet in the set is a known MM wallet. */
export function hasKnownMMWallet(chain: MMChain, addresses: string[]): boolean {
  return addresses.some((a) => findMMWallet(chain, a) !== null);
}

/** Registry is considered empty when no entries exist — downstream scoring
 *  then cannot use the "known MM wallet" signal and must rely on wash +
 *  cluster heuristics only. */
export function isRegistryEmpty(): boolean {
  return MM_WALLETS.length === 0;
}
