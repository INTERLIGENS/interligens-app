import { WalletHop, SignalResult } from "../signals";
import { KNOWN_BRIDGES } from "../knownContracts";

export function runBridge(hops: WalletHop[]): SignalResult | null {
  const bridgeHops = hops.filter(h =>
    h.isBridge || (h.protocol && KNOWN_BRIDGES.some(b => h.protocol!.toLowerCase().includes(b)))
  );

  if (bridgeHops.length === 0) return null;

  // A bridge signal is only confirmed if at least one hop has direct on-chain evidence
  const hasConfirmedBridge = bridgeHops.some(h => h.evidenceLevel === "confirmed");
  const severity = bridgeHops.length >= 2 ? "STRONG" : "MODERATE";

  if (hasConfirmedBridge) {
    return {
      family: "BRIDGE",
      confirmed: true,
      severity,
      detail: bridgeHops.length >= 2
        ? `Funds crossed ${bridgeHops.length} bridges in sequence — cascade detected.`
        : `Funds routed through cross-chain bridge (${bridgeHops[0].protocol ?? "unknown bridge"}).`,
      rawData: { bridgeCount: bridgeHops.length, bridges: bridgeHops.map(h => h.protocol ?? null) },
    };
  }

  // Adjacent/inferred: cross-chain presence observed but no direct bridge TX
  return {
    family: "BRIDGE",
    confirmed: false,
    severity: "WEAK",
    detail: "Cross-chain wallet presence detected — actor holds addresses on multiple chains, suggesting cross-chain routing, but no direct bridge transaction was observed.",
    rawData: { bridgeCount: bridgeHops.length, bridges: bridgeHops.map(h => h.protocol ?? null) },
  };
}
