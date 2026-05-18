// ─── Admin override list (spec §11.3) ─────────────────────────────────────
// Reads MM_OVERRIDE_TOKENS — a comma-separated list of `mint:chain` pairs
// that must never be capped by the MM integration. Used by Dood to unblock
// specific tokens that legitimately happen to trade near the detector
// thresholds.
//
// Format: "mint1:SOLANA,mint2:ETHEREUM". Whitespace is tolerated.
// When the variable is unset or empty the function always returns false.

import type { MmChain } from "../types";
import type { EnvBag } from "./featureFlag";

function parseOverrides(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  const out = new Set<string>();
  for (const token of raw.split(",")) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const [mint, chain] = trimmed.split(":");
    if (!mint || !chain) continue;
    out.add(`${mint.trim()}:${chain.trim().toUpperCase()}`);
  }
  return out;
}

export function checkMmOverride(
  tokenMint: string,
  chain: MmChain,
  env: EnvBag = process.env,
): boolean {
  if (!tokenMint || !chain) return false;
  const overrides = parseOverrides(env.MM_OVERRIDE_TOKENS);
  if (overrides.size === 0) return false;
  return overrides.has(`${tokenMint}:${chain.toUpperCase()}`);
}

export function listMmOverrides(env: EnvBag = process.env): string[] {
  return [...parseOverrides(env.MM_OVERRIDE_TOKENS)];
}

export const MM_OVERRIDE_ENV_KEY = "MM_OVERRIDE_TOKENS";
