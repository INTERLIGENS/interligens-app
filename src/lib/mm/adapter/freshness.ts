// ─── Freshness (spec §8.1) ────────────────────────────────────────────────
// Pure helper: derives staleness from an ISO or Date timestamp. No I/O.
//
// Tiers:
//   • fresh :  < 6 hours
//   • aging : 6 — 24 hours
//   • stale : ≥ 24 hours (UI adds an explicit age disclaimer)

import type { Freshness, Staleness } from "./types";

export const FRESH_MAX_MINUTES = 6 * 60;
export const AGING_MAX_MINUTES = 24 * 60;

export function stalenessOf(ageMinutes: number): Staleness {
  if (ageMinutes < FRESH_MAX_MINUTES) return "fresh";
  if (ageMinutes < AGING_MAX_MINUTES) return "aging";
  return "stale";
}

export function computeFreshness(
  computedAt: Date | string,
  nowMs?: number,
): Freshness {
  const computedDate =
    typeof computedAt === "string" ? new Date(computedAt) : computedAt;
  const baseNow = typeof nowMs === "number" ? nowMs : Date.now();
  const ageMs = Math.max(0, baseNow - computedDate.getTime());
  const ageMinutes = Math.round(ageMs / 60_000);
  return {
    computedAt: computedDate.toISOString(),
    ageMinutes,
    staleness: stalenessOf(ageMinutes),
  };
}
