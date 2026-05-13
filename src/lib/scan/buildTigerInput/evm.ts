/**
 * REFLEX V1 — EVM TigerInput builder.
 *
 * TEMPORARY DUPLICATION of /api/scan/evm/route.ts. See
 * docs/reflex-v1-tech-debt.md for the post-V1 factorisation plan.
 *
 * Replicates the route's TigerInput composition steps:
 *  1. detectActiveEvmChains(address) → activeChains[], details, allRpcDown
 *  2. isKnownBadEvm(address) → known-bad cross-chain probe
 *  3. Derive aggregated signals across active chains:
 *      - isContractAny: any chain reports bytecode
 *      - maxBalanceEth: max balance across chains (in ETH)
 *      - maxTxCount: max txCount across chains
 *  4. Primary chain tag = first active chain (Base → "BASE",
 *     Arbitrum → "ARBITRUM", else "ETH")
 *
 * The intelligence overlay (computeTigerScoreWithIntel) is applied
 * later by the REFLEX tigerscore adapter, NOT here — this helper
 * returns only the TigerInput.
 */
import {
  detectActiveEvmChains,
} from "@/lib/evm/chainDetect";
import { isKnownBadEvm } from "@/lib/entities/knownBad";
import type { TigerInput } from "@/lib/tigerscore/engine";

export async function buildEvmTigerInput(address: string): Promise<TigerInput> {
  // 1. Multi-chain RPC fan-out (ETH / Base / Arbitrum).
  const { activeChains, details } = await detectActiveEvmChains(address);

  // 2. Known-bad cross-chain probe (shared address space across EVM).
  const knownBadHit = isKnownBadEvm(address);

  // 3. Aggregated signals — same reductions as the route.
  const isContractAny = Object.values(details).some((d) => d.isContract);
  const maxBalanceEth = Math.max(
    ...Object.values(details).map((d) => {
      // bigint wei → number ETH, matching the route's conversion exactly.
      const raw = d.balanceRaw;
      return Number(raw / 10n ** 15n) / 1000;
    }),
  );
  const maxTxCount = Math.max(
    ...Object.values(details).map((d) => d.transactionCount),
  );

  // 4. Primary chain selection.
  const primaryChain =
    activeChains[0] === "base"
      ? "BASE"
      : activeChains[0] === "arbitrum"
        ? "ARBITRUM"
        : "ETH";

  const tigerInput: TigerInput = {
    chain: primaryChain as "ETH" | "BASE" | "ARBITRUM",
    deep: false,
    txCount: maxTxCount,
    evm_is_contract: isContractAny,
    evm_balance_eth: maxBalanceEth,
    evm_active_chains: activeChains,
    evm_known_bad: !!knownBadHit,
    evm_in_watchlist: false,
  };

  return tigerInput;
}
