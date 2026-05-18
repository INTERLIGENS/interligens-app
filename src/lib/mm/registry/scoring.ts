import type { MmAttribMethod, MmStatus } from "../types";
import { MM_STATUS_DEFAULT_SCORE_RANGE } from "../types";

export interface AttributionLike {
  attributionMethod: MmAttribMethod;
  confidence: number;
  revokedAt: Date | null;
}

export interface EntityLike {
  status: MmStatus;
  defaultScore: number;
}

export interface RegistryScoreInput {
  entity: EntityLike | null;
  attribution: AttributionLike | null;
}

export function computeRegistryDrivenScore(input: RegistryScoreInput): number {
  if (!input.entity || !input.attribution) return 0;
  if (input.attribution.revokedAt) return 0;

  const range = MM_STATUS_DEFAULT_SCORE_RANGE[input.entity.status];
  if (range.max === 0) return 0;

  if (input.attribution.confidence < range.minConfidence) return 0;

  const clamped = Math.max(range.min, Math.min(range.max, input.entity.defaultScore));
  if (input.attribution.attributionMethod === "INFERRED_CLUSTER") {
    return Math.min(clamped, 70);
  }
  return clamped;
}

export type RegistryConfidence = "low" | "medium" | "high";

export function registryConfidenceFor(input: {
  entity: EntityLike | null;
  attribution: AttributionLike | null;
}): RegistryConfidence {
  if (!input.entity || !input.attribution || input.attribution.revokedAt) return "low";
  const s = input.entity.status;
  if (s === "CONVICTED" && input.attribution.confidence >= 0.9) return "high";
  if (s === "CHARGED" && input.attribution.confidence >= 0.9) return "high";
  if (
    (s === "SETTLED" || s === "DOCUMENTED") &&
    input.attribution.confidence >= 0.8
  ) {
    return "medium";
  }
  return "low";
}
