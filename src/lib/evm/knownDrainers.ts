/**
 * Known-drainer registry (EVM).
 *
 * A drainer is a smart-contract spender that, once granted ERC-20/ERC-721
 * approval or a Permit/Permit2 signature, sweeps the wallet. The list
 * below is seeded from the shared `KNOWN_BAD` corpus (single source of
 * truth) filtered to `category === "drainer"`, plus any additional public
 * drainer addresses we want to track per-chain.
 *
 * The list is **incomplete by nature** — drainer addresses rotate. Update
 * it from confirmed public disclosures (e.g. ZachXBT threads, Scamsniffer,
 * Chainabuse). Never hardcode unverified addresses: false positives in a
 * drainer list are worse than misses.
 */

import { KNOWN_BAD, type KnownBadEntry } from "@/lib/entities/knownBad";

export interface DrainerEntry {
  /** Spender contract address (lowercased for match). */
  address: string;
  /** EVM chain the address was observed on (ETH / BSC / BASE / ARBITRUM). */
  chain: string;
  /** Public name of the drainer family (Inferno, Angel, Pink, etc.). */
  label: string;
  /** Source of the intelligence (for audit trails). */
  source: string;
}

const FROM_KNOWN_BAD: DrainerEntry[] = (KNOWN_BAD as readonly KnownBadEntry[])
  .filter((e) => e.category === "drainer")
  .map((e) => ({
    address: e.address.toLowerCase(),
    chain: e.chain,
    label: e.label,
    source: "knownBad.ts",
  }));

// Additional public addresses not yet in KNOWN_BAD can be appended here.
// Each entry MUST cite a public source in its `source` field.
const ADDITIONAL: DrainerEntry[] = [];

export const KNOWN_DRAINERS: readonly DrainerEntry[] = [
  ...FROM_KNOWN_BAD,
  ...ADDITIONAL,
];

/** Case-insensitive match. Pass a lowercased address to skip conversion. */
export function isKnownDrainer(
  address: string,
  chain?: string,
): DrainerEntry | null {
  const lc = address.toLowerCase();
  for (const d of KNOWN_DRAINERS) {
    if (d.address !== lc) continue;
    if (chain && d.chain !== chain) continue;
    return d;
  }
  return null;
}
