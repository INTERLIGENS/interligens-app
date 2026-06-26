// ─── Solana mint validation / normalisation ────────────────────────────────
// Shared by the canonical token-resolution service (Evidence Intake Bridge).
//
// Base58 alphabet excludes 0 / O / I / l. SPL mints are 32-44 chars. pump.fun
// mints carry the literal "pump" suffix. Base58 is CASE-SENSITIVE — never
// lowercase a mint (unlike EVM hex addresses).
//
// Regex mirrors the one already used across the repo (src/lib/ingestion/
// pipeline.ts, the scan route's isScanableAddress) so validation stays uniform.

const SOL_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export interface NormalizedSolanaMint {
  valid: boolean;
  mint: string | null;
  isPumpFun: boolean;
  reason?: string;
}

export function normalizeSolanaMint(raw: string | null | undefined): NormalizedSolanaMint {
  const t = (raw ?? "").trim();
  if (!t) return { valid: false, mint: null, isPumpFun: false, reason: "empty" };
  if (!SOL_MINT_RE.test(t)) {
    return { valid: false, mint: null, isPumpFun: false, reason: "not_base58_32_44" };
  }
  return { valid: true, mint: t, isPumpFun: t.endsWith("pump") };
}

export function isValidSolanaMint(raw: string | null | undefined): boolean {
  return normalizeSolanaMint(raw).valid;
}

// Order-preserving, de-duplicated set of valid Solana mints from a raw list.
export function extractValidSolanaMints(addresses: string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const a of addresses ?? []) {
    const n = normalizeSolanaMint(a);
    if (n.valid && n.mint && !out.includes(n.mint)) out.push(n.mint);
  }
  return out;
}
