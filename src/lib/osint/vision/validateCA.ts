/**
 * src/lib/osint/vision/validateCA.ts
 *
 * OSINT Vision Ingest V1 — code-level contract-address guard.
 *
 * The vision model is instructed to only emit a CA it reads with 100% certainty
 * and otherwise return null. This module is the SECOND, code-side gate: it does
 * NOT trust the model. Any string that does not match a STRICT Solana base58 or
 * EVM hex format is rejected and the caller must fall back to "PENDING:<TICKER>".
 *
 * It never repairs, completes, or guesses an address. It only accepts or rejects.
 */

// Solana: base58 (no 0, O, I, l), 32–44 chars. Mints/CAs are 43–44 in practice
// but we accept the full valid base58 length range to avoid false rejections.
const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
// EVM: 0x + exactly 40 hex chars.
const EVM_RE = /^0x[a-fA-F0-9]{40}$/;

export type CAChain = "solana" | "ethereum";

export interface ValidateCAResult {
  /** true only if `address` is a strictly well-formed Solana/EVM address. */
  valid: boolean;
  /** Chain DERIVED from the address format (authoritative when valid). */
  inferredChain: CAChain | null;
  /** Reason for rejection, for warnings/audit. null when valid. */
  reason: string | null;
}

/**
 * Strictly validate a contract address. Returns inferredChain when valid —
 * the address FORMAT is authoritative for chain (0x… = EVM, base58 = Solana),
 * which legitimately disambiguates a vision "chain: unknown" without guessing.
 */
export function validateCA(addr: unknown): ValidateCAResult {
  if (typeof addr !== "string") {
    return { valid: false, inferredChain: null, reason: "not_a_string" };
  }
  const a = addr.trim();
  if (!a) return { valid: false, inferredChain: null, reason: "empty" };

  // A PENDING sentinel is intentionally "not a real CA" — reject so the caller
  // keeps it as-is and never treats it as resolved.
  if (a.toUpperCase().startsWith("PENDING:")) {
    return { valid: false, inferredChain: null, reason: "pending_sentinel" };
  }

  if (EVM_RE.test(a)) return { valid: true, inferredChain: "ethereum", reason: null };
  if (SOLANA_RE.test(a)) return { valid: true, inferredChain: "solana", reason: null };

  return { valid: false, inferredChain: null, reason: "format_mismatch" };
}

/** Build the canonical PENDING sentinel for a ticker (uppercased, sanitized). */
export function pendingFor(tokenSymbol: string | null | undefined): string {
  const t = (tokenSymbol ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return `PENDING:${t || "UNKNOWN"}`;
}

/** True if a contractAddress string is a PENDING sentinel. */
export function isPending(addr: unknown): boolean {
  return typeof addr === "string" && addr.toUpperCase().startsWith("PENDING:");
}
