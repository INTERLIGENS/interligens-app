/**
 * REFLEX V1 — input router.
 *
 * Classifies a raw user input (copy-pasted address, URL, ticker, or
 * @handle) into a structured ReflexResolvedInput so the verdict pipeline
 * knows which engines to fan out to.
 *
 * V1 is pure shape detection: no network, no DB, no async. The order of
 * checks below is significant because some shapes overlap (e.g. a TRON
 * address is also valid base58 of length 34, so TRON is tried first).
 *
 * For Solana base58 and EVM 0x shapes the default classification is
 * SOLANA_TOKEN / EVM_TOKEN — downstream engines may refine to WALLET
 * once an on-chain check confirms an address is an EOA, not a contract.
 *
 * Tickers (TICKER) are resolved to candidate addresses downstream via the
 * existing /api/scan/resolve endpoint; the router only detects the shape.
 */

import { MAX_INPUT_LENGTH } from "./constants";
import type { ReflexResolvedInput } from "./types";

// ─────────────────────────────────────────────────────────────────────────
// Shape detectors
// ─────────────────────────────────────────────────────────────────────────

const X_HANDLE_RE = /^@([A-Za-z0-9_]{1,15})$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const SOLANA_BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const URL_SCHEMED_RE = /^https?:\/\//i;
/**
 * Schemeless domain. Requires at least one dot followed by an alpha-only
 * TLD of 2+ chars, so "1.2.3.4" and "1234.5678" don't false-positive.
 */
const URL_SCHEMELESS_RE =
  /^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}(?:\/.*)?$/;
/** Ticker: 2–10 chars, optional $ prefix, first char alpha, rest alphanumeric. */
const TICKER_RE = /^\$?([A-Za-z][A-Za-z0-9]{1,9})$/;

function isXHandle(s: string): boolean {
  return X_HANDLE_RE.test(s);
}

function isUrl(s: string): boolean {
  if (URL_SCHEMED_RE.test(s)) {
    try {
      const u = new URL(s);
      return !!u.host;
    } catch {
      return false;
    }
  }
  return URL_SCHEMELESS_RE.test(s);
}

function isEvmAddress(s: string): boolean {
  return EVM_ADDRESS_RE.test(s);
}

function isTronAddress(s: string): boolean {
  return TRON_ADDRESS_RE.test(s);
}

function isSolanaAddress(s: string): boolean {
  return SOLANA_BASE58_RE.test(s);
}

function isTicker(s: string): boolean {
  return TICKER_RE.test(s);
}

// ─────────────────────────────────────────────────────────────────────────
// Normalizers
// ─────────────────────────────────────────────────────────────────────────

function normalizeXHandle(s: string): string {
  const m = s.match(X_HANDLE_RE);
  return m ? m[1].toLowerCase() : s.toLowerCase();
}

function normalizeUrl(s: string): string {
  try {
    const withScheme = URL_SCHEMED_RE.test(s) ? s : `https://${s}`;
    const u = new URL(withScheme);
    const host = u.host.toLowerCase();
    const path = u.pathname === "/" ? "" : u.pathname;
    const search = u.search || "";
    return `${u.protocol}//${host}${path}${search}`;
  } catch {
    return s;
  }
}

function normalizeTicker(s: string): string {
  const m = s.match(TICKER_RE);
  return m ? m[1].toUpperCase() : s.toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

/**
 * Classify a raw input string into a structured ReflexResolvedInput.
 * Pure function — no I/O, safe to call synchronously in hot paths.
 *
 * Falls through to `{ type: "UNKNOWN" }` for empty / oversized / unparseable
 * input. The caller decides how to react (e.g. ask the user to clarify).
 */
export function classify(rawInput: string): ReflexResolvedInput {
  if (typeof rawInput !== "string") {
    return { type: "UNKNOWN", raw: String(rawInput ?? "") };
  }

  const trimmed = rawInput.trim();
  if (!trimmed || trimmed.length > MAX_INPUT_LENGTH) {
    return { type: "UNKNOWN", raw: rawInput };
  }

  // 1. X handle — most specific (leading "@").
  if (isXHandle(trimmed)) {
    return {
      type: "X_HANDLE",
      handle: normalizeXHandle(trimmed),
      raw: rawInput,
    };
  }

  // 2. URL — explicit scheme or schemeless domain with a real TLD.
  if (isUrl(trimmed)) {
    return {
      type: "URL",
      url: normalizeUrl(trimmed),
      raw: rawInput,
    };
  }

  // 3. EVM 0x address. Chain is left generic ("evm") at the router layer;
  //    the TigerScore adapter resolves the actual chain downstream by
  //    probing Base → Arbitrum → BSC → Polygon → Ethereum in order.
  if (isEvmAddress(trimmed)) {
    return {
      type: "EVM_TOKEN",
      chain: "evm",
      address: trimmed.toLowerCase(),
      raw: rawInput,
    };
  }

  // 4. TRON address — checked before Solana because a TRON address is
  //    also valid base58 of length 34.
  if (isTronAddress(trimmed)) {
    return {
      type: "WALLET",
      chain: "tron",
      address: trimmed,
      raw: rawInput,
    };
  }

  // 5. Solana base58.
  if (isSolanaAddress(trimmed)) {
    return {
      type: "SOLANA_TOKEN",
      chain: "sol",
      address: trimmed,
      raw: rawInput,
    };
  }

  // 6. Ticker — last because it overlaps with short alphanumeric noise.
  if (isTicker(trimmed)) {
    return {
      type: "TICKER",
      ticker: normalizeTicker(trimmed),
      raw: rawInput,
    };
  }

  return { type: "UNKNOWN", raw: rawInput };
}
