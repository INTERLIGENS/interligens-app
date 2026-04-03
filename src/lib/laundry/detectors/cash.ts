import { WalletHop, SignalResult } from "../signals";
import { KNOWN_CEX_CLUSTERS } from "../knownContracts";

export function runCash(hops: WalletHop[]): SignalResult | null {
  const cexHop = hops.find(h => h.isCexDeposit || KNOWN_CEX_CLUSTERS.includes(h.address));

  if (cexHop) {
    return {
      family: "CASH",
      confirmed: true,
      severity: "MODERATE",
      detail: "Funds routed toward likely CEX deposit cluster — probable off-ramp preparation detected.",
      rawData: { address: cexHop.address },
    };
  }

  // Detect DEX sell cashout patterns (token → stablecoin/SOL conversions)
  const dexSellHops = hops.filter(h => h.protocol === "dex_sell" && h.amountUsd && h.amountUsd > 0);
  if (dexSellHops.length >= 1) {
    const totalUsd = dexSellHops.reduce((s, h) => s + (h.amountUsd ?? 0), 0);
    const walletCount = new Set(dexSellHops.map(h => h.address)).size;
    return {
      family: "CASH",
      confirmed: true,
      severity: totalUsd >= 20000 ? "STRONG" : "MODERATE",
      detail: walletCount >= 2
        ? `Token-to-stablecoin conversions detected across ${walletCount} wallets — on-chain cashout activity totaling ~$${Math.round(totalUsd / 1000)}K observed.`
        : `On-chain cashout activity totaling ~$${Math.round(totalUsd / 1000)}K observed from identified wallet.`,
      rawData: { dexSellCount: dexSellHops.length, totalUsd },
    };
  }

  return null;
}
