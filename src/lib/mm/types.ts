// ─── MM types (release surface) ────────────────────────────────────────────
// Only enums backing the 5 models shipped in this release. Registry enums
// (MmAttribMethod, MmClaimType, MmStatus, MmWorkflow, etc.) live exclusively
// on feat/mm-tracker and are re-imported when that sub-module lands.

import type {
  MmChain,
  MmRiskBand,
  MmSubjectType,
  MmDetectorType,
  MmTriggerType,
  MmSeverity,
} from "@prisma/client";

export type {
  MmChain,
  MmRiskBand,
  MmSubjectType,
  MmDetectorType,
  MmTriggerType,
  MmSeverity,
};

export const MM_SCHEMA_VERSION = 1;
export const MM_ENGINE_VERSION = "0.1.0-engine";
