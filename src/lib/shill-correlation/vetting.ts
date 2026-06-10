// src/lib/shill-correlation/vetting.ts
// PHASE 4.6 — pure classification of a WalletProfile into an exclusion verdict
// (no I/O, unit-tested). Thresholds documented below; tuned to separate
// automated routers/bots/HFT from a plausible human KOL-follower.

import type { WalletProfile } from "./wallet-profile";

export const VET_THRESHOLDS = {
  // >= this many tx in trailing 30d => high_frequency. A human following a KOL
  // does not sustain ~25 tx/day every day for a month; routers/bots do.
  highFrequencyTx30d: 750,
  // > this many distinct SPL token accounts held => too_many_tokens. Routers and
  // sniper bots accumulate dust from hundreds of tokens; a focused trader does not.
  manyTokenAccounts: 50,
} as const;

export type ExclusionReason =
  | "high_frequency"
  | "too_many_tokens"
  | "bot_infra";

export interface VetVerdict {
  excludedReason: ExclusionReason | null; // null => survives dynamic vetting
  flags: ExclusionReason[]; // all matched patterns (for the audit trail)
  txCount30d: number;
  distinctTokenAccounts: number;
  infraHits: string[];
}

/**
 * Classify a profile. Excludes on ANY matched pattern (per brief). Precedence
 * for the single stored reason: high_frequency > too_many_tokens > bot_infra,
 * but `flags` records every match.
 */
export function classifyWalletProfile(profile: WalletProfile): VetVerdict {
  const flags: ExclusionReason[] = [];

  if (profile.txCount30d >= VET_THRESHOLDS.highFrequencyTx30d) {
    flags.push("high_frequency");
  }
  if (profile.distinctTokenAccounts > VET_THRESHOLDS.manyTokenAccounts) {
    flags.push("too_many_tokens");
  }
  if (profile.infraHits.length > 0) {
    flags.push("bot_infra");
  }

  return {
    excludedReason: flags[0] ?? null,
    flags,
    txCount30d: profile.txCount30d,
    distinctTokenAccounts: profile.distinctTokenAccounts,
    infraHits: profile.infraHits,
  };
}
