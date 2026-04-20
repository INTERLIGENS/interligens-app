// ─── displayScore (spec §8.3, §8.6) ───────────────────────────────────────
// Pure helpers. The spec uses a max of the two source scores rather than an
// average: the idea is that either a Registry floor (for attributed wallets
// tied to documented entities) OR a behavioral aggregate is enough, on its
// own, to drive the displayed value.
//
// Bands:
//   0-19   → GREEN
//   20-39  → YELLOW
//   40-69  → ORANGE
//   70-100 → RED

import type { MmRiskBand } from "../types";

export function consolidateDisplayScore(
  registryDrivenScore: number,
  behaviorDrivenScore: number,
): number {
  const reg = clampScore(registryDrivenScore);
  const beh = clampScore(behaviorDrivenScore);
  return Math.max(reg, beh);
}

export function bandOf(score: number): MmRiskBand {
  const s = clampScore(score);
  if (s < 20) return "GREEN";
  if (s < 40) return "YELLOW";
  if (s < 70) return "ORANGE";
  return "RED";
}

function clampScore(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 100) return 100;
  return Math.round(x);
}
