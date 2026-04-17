// ─── Adapter types (spec §4.3, §8) ─────────────────────────────────────────
// The adapter is the only layer where Registry (Produit A) and Pattern
// Engine (Produit B) are consolidated. Its output type is the single canonical
// object consumed by the assess API endpoint and the UI.

import type {
  MmAttribMethod,
  MmChain,
  MmRiskBand,
  MmStatus,
  MmSubjectType,
} from "../types";
import type {
  CohortPercentiles,
  ConfidenceLevel,
  CoverageLevel,
  DetectorOutput,
  DetectorSignal,
} from "../engine/types";

export type DominantDriver = "REGISTRY" | "BEHAVIORAL" | "MIXED" | "NONE";

export type DisplayReason =
  | "ENTITY_CONVICTED_ATTRIBUTED"
  | "ENTITY_DOCUMENTED_ATTRIBUTED"
  | "BEHAVIORAL_PATTERN_HIGH"
  | "BEHAVIORAL_PATTERN_MEDIUM"
  | "BEHAVIORAL_INSUFFICIENT"
  | "MIXED_REGISTRY_AND_PATTERN"
  | "NO_SIGNAL";

export type Staleness = "fresh" | "aging" | "stale";

export interface Freshness {
  computedAt: string; // ISO
  ageMinutes: number;
  staleness: Staleness;
}

export interface RegistryEntitySummary {
  id: string;
  slug: string;
  name: string;
  status: MmStatus;
  riskBand: MmRiskBand;
  jurisdiction: string | null;
  workflow: string;
  defaultScore: number;
}

export interface AttributionSummary {
  id: string;
  confidence: number;
  method: MmAttribMethod;
  attributedAt: string; // ISO (createdAt or reviewedAt)
  reviewerUserId: string | null;
}

export interface RegistryComponent {
  entity: RegistryEntitySummary | null;
  attribution: AttributionSummary | null;
  registryDrivenScore: number; // 0-100
}

export interface EngineDetectorBreakdown {
  washTrading: DetectorOutput | null;
  cluster: DetectorOutput | null;
  concentration: DetectorOutput | null;
  priceAsymmetry: DetectorOutput | null;
  postListingPump: DetectorOutput | null;
}

export interface EngineComponent {
  behaviorDrivenScore: number; // 0-90
  rawBehaviorScore: number;
  confidence: ConfidenceLevel;
  coverage: CoverageLevel;
  signals: DetectorSignal[];
  detectorBreakdown: EngineDetectorBreakdown;
  capsApplied: string[];
  coOccurrence: { admitted: string[]; gatedOut: string[] };
  cohortKey: string | null;
  cohortPercentiles: CohortPercentiles | null;
}

export interface OverallComponent {
  displayScore: number; // 0-100
  band: MmRiskBand;
  dominantDriver: DominantDriver;
  displayReason: DisplayReason;
  disclaimer: string;
  freshness: Freshness;
}

export interface MmRiskAssessment {
  registry: RegistryComponent;
  engine: EngineComponent;
  overall: OverallComponent;
  subjectType: MmSubjectType;
  subjectId: string;
  chain: MmChain;
  scanRunId: string;
  schemaVersion: number;
  computedAt: string; // ISO
  /** "cache" = served from MmScore, "compute" = freshly computed. */
  source: "cache" | "compute";
}

// ─── Assess endpoint request surface ──────────────────────────────────────

export type AssessMode = "summary" | "expanded" | "full";

export interface AssessOptions {
  useCache?: boolean;
  maxAgeHours?: number;
  includeDetectorBreakdown?: boolean;
  includeSignals?: boolean;
  mode?: AssessMode;
}

export interface AssessInput {
  subjectType: MmSubjectType;
  subjectId: string;
  chain: MmChain;
  options?: AssessOptions;
}
