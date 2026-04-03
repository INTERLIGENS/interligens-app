import { WalletHop, SignalResult } from "../signals";
import { KNOWN_MIXERS } from "../knownContracts";

export function runMixer(hops: WalletHop[]): SignalResult | null {
  const directHit = hops.find(h => h.isMixer || KNOWN_MIXERS.includes(h.address));

  if (directHit) {
    return {
      family: "MIXER",
      confirmed: true,
      severity: "STRONG",
      detail: "Wallet interacted directly with a known mixer contract.",
      rawData: { address: directHit.address },
    };
  }

  return null;
}
