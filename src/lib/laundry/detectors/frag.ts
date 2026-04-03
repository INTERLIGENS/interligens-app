import { WalletHop, SignalResult } from "../signals";

export function runFrag(hops: WalletHop[]): SignalResult | null {
  const timeWindow = 48 * 60 * 60 * 1000; // 48h in ms
  const firstHop = hops[0];
  if (!firstHop) return null;

  const windowHops = hops.filter(h => h.timestamp - firstHop.timestamp <= timeWindow);
  const uniqueAddresses = new Set(windowHops.map(h => h.address));
  const count = uniqueAddresses.size;

  if (count < 5) return null;

  const severity = count >= 15 ? "STRONG" : count >= 7 ? "MODERATE" : "WEAK";

  return {
    family: "FRAG",
    confirmed: true,
    severity,
    detail: `Wallet fanned out to ${count} distinct addresses within 48h of a significant event.`,
    rawData: { uniqueAddressCount: count },
  };
}
