import { WalletHop, SignalResult } from "../signals";
import { KNOWN_PRIVACY_ENTRIES } from "../knownContracts";

export function runPriv(hops: WalletHop[]): SignalResult | null {
  const privHop = hops.find(h => h.isPrivacyService || KNOWN_PRIVACY_ENTRIES.includes(h.address));

  if (!privHop) return null;

  return {
    family: "PRIV",
    confirmed: true,
    severity: "STRONG",
    detail: "Funds entered a privacy-oriented routing service or rail. Trail opacity increases significantly at this point.",
    rawData: { address: privHop.address },
  };
}
