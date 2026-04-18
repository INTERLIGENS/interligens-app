/**
 * Address normaliser — conservative enough to not lose case for Solana,
 * but idempotent for EVM (lowercase 0x…).
 */
const EVM_RE = /^0x[0-9a-fA-F]{40}$/;
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/; // base58

export type NormalisedAddress = {
  address: string;
  chain: "EVM" | "SOL" | "BTC" | "TRON" | "OTHER";
} | null;

export function normaliseAddress(raw: string, chainHint?: string): NormalisedAddress {
  if (!raw) return null;
  const s = String(raw).trim();
  if (s.length < 10) return null;
  if (EVM_RE.test(s)) return { address: s.toLowerCase(), chain: "EVM" };
  if (SOL_RE.test(s) && !s.startsWith("0x")) return { address: s, chain: "SOL" };
  if (chainHint) {
    const hint = chainHint.toUpperCase();
    if (["EVM", "ETH", "BSC", "ARB", "MATIC", "POLYGON", "BASE", "OPTIMISM"].includes(hint))
      return { address: s.toLowerCase(), chain: "EVM" };
    if (hint === "SOL" || hint === "SOLANA") return { address: s, chain: "SOL" };
    if (hint === "BTC" || hint === "BITCOIN") return { address: s, chain: "BTC" };
    if (hint === "TRX" || hint === "TRON") return { address: s, chain: "TRON" };
  }
  // Unknown — store as OTHER so we don't mis-attribute to EVM.
  return { address: s, chain: "OTHER" };
}
