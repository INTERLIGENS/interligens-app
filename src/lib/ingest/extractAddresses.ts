
export interface CandidateLabel {
  address: string;
  chain: string;
  page?: number;
}

const EVM_RE = /0x[a-fA-F0-9]{40}/g;
const TRON_RE = /T[1-9A-HJ-NP-Za-km-z]{33}/g;
const SOL_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

export function extractAddresses(text: string): CandidateLabel[] {
  const seen = new Set<string>();
  const results: CandidateLabel[] = [];

  const add = (address: string, chain: string) => {
    if (seen.has(address)) return;
    seen.add(address);
    results.push({ address, chain });
  };

  for (const m of text.matchAll(EVM_RE)) add(m[0], "EVM");
  for (const m of text.matchAll(TRON_RE)) add(m[0], "TRON");

  // SOL: filter out EVM/TRON already seen + must be plausible base58
  for (const m of text.matchAll(SOL_RE)) {
    const s = m[0];
    if (seen.has(s)) continue;
    if (/^0x/.test(s)) continue;
    if (s.length < 32 || s.length > 44) continue;
    add(s, "SOL");
  }

  return results;
}
