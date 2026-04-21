import type {
  MmAttribMethod,
  MmChain,
  MmClaimType,
  MmPubStatus,
  MmRiskBand,
  MmSourceType,
  MmCredTier,
  MmStatus,
  MmTargetType,
  MmReviewAction,
  MmWorkflow,
  MmVerifMethod,
  MmVerifStatus,
  MmSubjectType,
  MmDetectorType,
  MmTriggerType,
  MmSeverity,
} from "@prisma/client";

export type {
  MmAttribMethod,
  MmChain,
  MmClaimType,
  MmPubStatus,
  MmRiskBand,
  MmSourceType,
  MmCredTier,
  MmStatus,
  MmTargetType,
  MmReviewAction,
  MmWorkflow,
  MmVerifMethod,
  MmVerifStatus,
  MmSubjectType,
  MmDetectorType,
  MmTriggerType,
  MmSeverity,
};

export const MM_SCHEMA_VERSION = 1;
export const MM_ENGINE_VERSION = "0.1.0-registry";

export const ALLOWED_WORKFLOW_TRANSITIONS: Record<MmWorkflow, MmWorkflow[]> = {
  DRAFT: ["REVIEWED", "UNPUBLISHED"],
  REVIEWED: ["PUBLISHED", "DRAFT", "UNPUBLISHED"],
  PUBLISHED: ["CHALLENGED", "UNPUBLISHED"],
  CHALLENGED: ["PUBLISHED", "UNPUBLISHED", "DRAFT"],
  UNPUBLISHED: ["DRAFT"],
};

export const MM_STATUS_TO_RISK_BAND: Record<MmStatus, MmRiskBand> = {
  CONVICTED: "RED",
  CHARGED: "RED",
  SETTLED: "ORANGE",
  INVESTIGATED: "ORANGE",
  DOCUMENTED: "ORANGE",
  OBSERVED: "YELLOW",
};

export const MM_STATUS_DEFAULT_SCORE_RANGE: Record<
  MmStatus,
  { min: number; max: number; minConfidence: number }
> = {
  CONVICTED: { min: 90, max: 100, minConfidence: 0.9 },
  CHARGED: { min: 75, max: 89, minConfidence: 0.9 },
  SETTLED: { min: 65, max: 74, minConfidence: 0.85 },
  INVESTIGATED: { min: 45, max: 54, minConfidence: 0.8 },
  DOCUMENTED: { min: 55, max: 64, minConfidence: 0.8 },
  OBSERVED: { min: 0, max: 0, minConfidence: 0 },
};

export interface WorkflowTransition {
  from: MmWorkflow;
  to: MmWorkflow;
}

export function isAllowedTransition(from: MmWorkflow, to: MmWorkflow): boolean {
  if (from === to) return false;
  return ALLOWED_WORKFLOW_TRANSITIONS[from].includes(to);
}
