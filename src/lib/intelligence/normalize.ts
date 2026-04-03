// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — Value Normalization
// Addresses, domains, contracts. Pure functions, no DB access.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "crypto";
import type { IntelEntityType } from "./types";

export function normalizeAddress(raw: string): string {
  if (raw.startsWith("0x")) return raw.toLowerCase();
  return raw.trim(); // Solana base58 — case-sensitive, preserve as-is
}

export function normalizeDomain(raw: string): string {
  let d = raw.trim();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.replace(/\/.*$/, "");
  d = d.replace(/:\d+$/, "");
  return d.toLowerCase().trim();
}

export function buildDedupKey(type: IntelEntityType, value: string): string {
  return createHash("sha256").update(`${type}:${value}`).digest("hex");
}

export function normalizeValue(type: IntelEntityType, raw: string): string {
  switch (type) {
    case "ADDRESS":
    case "CONTRACT":
    case "TOKEN_CA":
      return normalizeAddress(raw);
    case "DOMAIN":
      return normalizeDomain(raw);
    default:
      return raw.trim();
  }
}
