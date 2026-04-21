// ─── displayReason & dominantDriver (spec §8.2) ───────────────────────────
// Pure helpers. Both functions take numeric scores (plus, for displayReason,
// the Registry attribution object) and return opaque string enums consumed
// by the UI and the copy layer.

// Registry status is opaque on this release surface (always null). Typed as
// string so the historical code-path still compiles without the registry.
type MmStatus = string;
import type { ConfidenceLevel } from "../engine/types";
import type { AttributionSummary, DisplayReason, DominantDriver } from "./types";

const MIN_BEHAVIORAL_FOR_DRIVER = 20;
const MIXED_DELTA = 15;

export function classifyDominantDriver(
  registryDrivenScore: number,
  behaviorDrivenScore: number,
): DominantDriver {
  const reg = Math.max(0, registryDrivenScore);
  const beh = Math.max(0, behaviorDrivenScore);
  if (reg === 0 && beh < MIN_BEHAVIORAL_FOR_DRIVER) return "NONE";
  if (reg === 0) return "BEHAVIORAL";
  if (beh < MIN_BEHAVIORAL_FOR_DRIVER) return "REGISTRY";
  if (Math.abs(reg - beh) < MIXED_DELTA) return "MIXED";
  return reg > beh ? "REGISTRY" : "BEHAVIORAL";
}

export interface DisplayReasonInput {
  registryDrivenScore: number;
  behaviorDrivenScore: number;
  confidence: ConfidenceLevel;
  attribution: AttributionSummary | null;
  entityStatus: MmStatus | null;
  dominantDriver: DominantDriver;
}

export function classifyDisplayReason(input: DisplayReasonInput): DisplayReason {
  const {
    registryDrivenScore,
    behaviorDrivenScore,
    confidence,
    attribution,
    entityStatus,
    dominantDriver,
  } = input;

  if (dominantDriver === "NONE") return "NO_SIGNAL";

  if (dominantDriver === "MIXED") return "MIXED_REGISTRY_AND_PATTERN";

  if (dominantDriver === "REGISTRY") {
    if (!attribution || !entityStatus) {
      // Unexpected but handle defensively: treat as documented-level.
      return "ENTITY_DOCUMENTED_ATTRIBUTED";
    }
    if (entityStatus === "CONVICTED" && attribution.confidence >= 0.9) {
      return "ENTITY_CONVICTED_ATTRIBUTED";
    }
    return "ENTITY_DOCUMENTED_ATTRIBUTED";
  }

  // dominantDriver === "BEHAVIORAL"
  if (confidence === "high" && behaviorDrivenScore >= 60) {
    return "BEHAVIORAL_PATTERN_HIGH";
  }
  if (confidence !== "low" && behaviorDrivenScore >= 40) {
    return "BEHAVIORAL_PATTERN_MEDIUM";
  }
  // Avoid lint warning on unused import while keeping the arg on the surface.
  void registryDrivenScore;
  return "BEHAVIORAL_INSUFFICIENT";
}
