// src/lib/intel-vault/address.ts
export const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
export const BASE58_CHARSET = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function detectChain(addr: string): "ethereum"|"solana"|"other" {
  if (EVM_RE.test(addr)) return "ethereum";
  if (BASE58_CHARSET.test(addr)) return "solana";
  return "other";
}

export function isValidAddress(addr: string): boolean {
  return EVM_RE.test(addr) || BASE58_CHARSET.test(addr);
}

/** Given a list of column names, return index of best candidate for address column */
export function pickAddressColumn(headers: string[], rows: string[][]): number {
  const counts = headers.map((_, ci) =>
    rows.filter(r => isValidAddress((r[ci] ?? "").trim())).length
  );
  const max = Math.max(...counts);
  if (max === 0) return -1;
  return counts.indexOf(max);
}
