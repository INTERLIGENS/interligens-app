import { getEvmAccountInfo, type EvmChainKey, type EvmAccountInfo } from "@/lib/rpc";

export type AddressType = "solana" | "evm" | "unknown";

/**
 * Classify an address by surface syntax.
 * - EVM: 0x + 40 hex chars
 * - Solana: base58, 32-44 chars, no 0x prefix
 */
export function detectAddressType(address: string): AddressType {
  const trimmed = address.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return "evm";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) return "solana";
  return "unknown";
}

export type EvmChainActivity = EvmAccountInfo & {
  hasActivity: boolean;
};

/**
 * Fan-out RPC lookup across ETH / Base / Arbitrum to detect which EVM
 * chains the address is active on. "Active" = balance > 0 OR transactionCount > 0.
 *
 * Returns the ordered list of active chain keys. If none are active and no
 * RPC is down, falls back to `["ethereum"]` as default (spec rule).
 */
export async function detectActiveEvmChains(
  address: string
): Promise<{
  activeChains: EvmChainKey[];
  details: Record<EvmChainKey, EvmChainActivity>;
  allRpcDown: boolean;
}> {
  const chains: EvmChainKey[] = ["ethereum", "base", "arbitrum"];

  const results = await Promise.all(
    chains.map(async (chain) => {
      const info = await getEvmAccountInfo(address, chain);
      const hasActivity = info.balanceRaw > 0n || info.transactionCount > 0;
      return { chain, info: { ...info, hasActivity } };
    })
  );

  const details: Record<EvmChainKey, EvmChainActivity> = {
    ethereum: results[0].info,
    base: results[1].info,
    arbitrum: results[2].info,
  };

  const active = chains.filter((c) => details[c].hasActivity);
  const allRpcDown = results.every((r) => r.info.rpcDown);

  // Fallback: if no activity detected and at least one chain responded,
  // default to ethereum. If all RPCs are down, still return ethereum as the
  // canonical chain so the UI has something to anchor on.
  const activeChains = active.length > 0 ? active : ["ethereum" as EvmChainKey];

  return { activeChains, details, allRpcDown };
}
