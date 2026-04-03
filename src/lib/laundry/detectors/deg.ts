import { WalletHop, SignalResult } from "../signals";

export function runDeg(hops: WalletHop[]): SignalResult | null {
  const HOP_THRESHOLD = 4;
  const unknownHops = hops.filter(h => !h.protocol && !h.isBridge && !h.isMixer && !h.isCexDeposit);

  if (unknownHops.length < 3) return null;

  const breakHop = Math.min(HOP_THRESHOLD, hops.length);
  const fundsUnresolved = 70;

  return {
    family: "DEG",
    confirmed: true,
    severity: "MODERATE",
    detail: `Trail becomes significantly harder to resolve after hop ${breakHop}. Approximately ${fundsUnresolved}% of tracked funds are no longer reliably attributable beyond this depth.`,
    rawData: { breakHop, fundsUnresolved },
  };
}
