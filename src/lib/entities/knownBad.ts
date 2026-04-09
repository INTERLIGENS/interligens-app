export type KnownBadEntry = {
  address: string;
  chain: string;
  label: string;
  category: "drainer" | "scam" | "exploit" | "mixer" | "phishing";
  confidence: "low" | "medium" | "high";
};

// Placeholder list — replace with live feed in production
export const KNOWN_BAD: KnownBadEntry[] = [
  // ETH drainers
  { address: "0x00000000219ab540356cbb839cbe05303d7705fa", chain: "ETH", label: "ETH2 Deposit (misused)", category: "phishing", confidence: "medium" },
  { address: "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b", chain: "ETH", label: "Tornado Cash Proxy", category: "mixer", confidence: "high" },
  { address: "0x905b63fff465b9ffbf41dea908ceb12478ec7601", chain: "ETH", label: "Known Phishing Contract", category: "phishing", confidence: "high" },
  { address: "0x00000000a991c429ee2ec6df19d40fe0c80088b8", chain: "ETH", label: "Blur Drainer", category: "drainer", confidence: "high" },
  { address: "0xba5ddd1f9d7f570dc94a51479a000e3bce967196", chain: "ETH", label: "Angel Drainer v2", category: "drainer", confidence: "high" },
  { address: "0x0000db5c8b030ae20308ac975898e09741e70000", chain: "ETH", label: "Inferno Drainer", category: "drainer", confidence: "high" },
  { address: "0x4c9bbfc1fbd93dfb509e718400978fbeedf590e9", chain: "ETH", label: "Known Scam Router", category: "scam", confidence: "medium" },
  // BSC drainers
  { address: "0x10c678da7c098da67671df3da9fded0a9c827c80", chain: "BSC", label: "BSC Drainer v1", category: "drainer", confidence: "high" },
  { address: "0x3a6d8ca21d1cf76f653a67577fa0d27453350dd8", chain: "BSC", label: "PancakeSwap Fake Router", category: "phishing", confidence: "high" },
  // SOL (base58)
  { address: "7ZhB5PZrNFCvSSKA9VJotGGKiRgSncQAFgTnBNzmCgcz", chain: "SOL", label: "SOL Drainer v1", category: "drainer", confidence: "medium" },
  // KOL scammers
  { address: "0xa5b0edf6b55128e0ddae8e51ac538c3188401d41", chain: "ETH", label: "GordonGekko", category: "scam", confidence: "high" },
];

export function isKnownBad(chain: string, address: string): KnownBadEntry | null {
  const normalized = address.toLowerCase();
  return KNOWN_BAD.find(
    e => e.chain.toUpperCase() === chain.toUpperCase() &&
         e.address.toLowerCase() === normalized
  ) ?? null;
}
