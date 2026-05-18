// src/lib/shill-to-exit/scorer.ts
// Scores a shill-to-exit pattern 0-100 based on timing + profit + repetition.

import type { ShillToExitResult } from "./types";

export interface ScorerInput {
  deltaDays: number;
  estimatedProfit: number;
  patternCount: number;
}

export function scoreShillToExit(input: ScorerInput): number {
  let score = 0;

  if (input.deltaDays < 1)      score += 30;
  else if (input.deltaDays < 3) score += 20;
  else if (input.deltaDays < 7) score += 10;

  if (input.estimatedProfit > 10_000) score += 20;
  else if (input.estimatedProfit > 1_000) score += 10;

  if (input.patternCount > 2) score += 10;

  return Math.min(score, 100);
}

export function confidenceFromDays(deltaDays: number): "HIGH" | "MEDIUM" | "LOW" {
  if (deltaDays < 1) return "HIGH";
  if (deltaDays < 3) return "MEDIUM";
  return "LOW";
}

export function scoreFromResult(result: ShillToExitResult, patternCount = 1): number {
  return scoreShillToExit({
    deltaDays: result.deltaDays,
    estimatedProfit: result.estimatedProfit,
    patternCount,
  });
}
