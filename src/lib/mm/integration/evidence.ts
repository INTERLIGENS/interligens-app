// ─── MM evidence for TigerScore (spec §11, §12.2 wording matrix) ─────────
// Pure module. Builds a TigerScoreAuditLog-compatible evidence object from a
// fully-resolved MmRiskAssessment. The wording strictly follows the status
// matrix from spec §12.2 to keep legal exposure minimal.

import type { MmStatus } from "../types";
import type { MmRiskAssessment } from "../adapter/types";

export type MmEvidencePriority = "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";

export interface MmTigerScoreEvidence {
  type: "MARKET_MAKER_RISK";
  priority: MmEvidencePriority;
  badge: "MM_FLAG";
  source: "INTERLIGENS_MM_TRACKER";
  claim: string;
  evidenceUrl: string;
  scoreImpact: number;
  mmDisplayScore: number;
  mmConfidence: string;
  mmCoverage: string;
  mmDominantDriver: string;
  freshness: string;
}

// ─── Wording matrix (spec §12.2) ──────────────────────────────────────────
// Only verbs/qualifiers explicitly authorised for each status are allowed.

const STATUS_CLAIM: Record<MmStatus, (name: string) => string> = {
  CONVICTED: (name) =>
    `Token market-maké par ${name}, entité condamnée pour manipulation de marché crypto.`,
  CHARGED: (name) =>
    `Token market-maké par ${name}, entité inculpée pour manipulation de marché crypto.`,
  SETTLED: (name) =>
    `Token market-maké par ${name}, entité ayant conclu un règlement réglementaire.`,
  INVESTIGATED: (name) =>
    `Token market-maké par ${name}, entité sous enquête d'un régulateur.`,
  DOCUMENTED: (name) =>
    `Token market-maké par ${name}, entité documentée par la presse établie pour des pratiques de manipulation.`,
  OBSERVED: (name) =>
    `Token associé à ${name}, entité mentionnée dans notre registre éditorial.`,
};

function behavioralOnlyClaim(confidence: string): string {
  const qualifier =
    confidence === "high"
      ? "patterns comportementaux on-chain détectés (wash trading, clusters coordonnés ou concentration anormale)"
      : "patterns comportementaux détectés (signal partiel)";
  return `Token sans attribution d'entité formelle — ${qualifier}.`;
}

export function priorityFor(
  displayScore: number,
  coverage: string,
  confidence: string,
): MmEvidencePriority {
  if (coverage === "low" || confidence === "low") return "INFO";
  if (displayScore >= 90) return "CRITICAL";
  if (displayScore >= 70) return "HIGH";
  if (displayScore >= 40) return "MEDIUM";
  return "INFO";
}

export interface BuildMmEvidenceInput {
  assessment: MmRiskAssessment;
  scoreImpact: number;
  /**
   * Absolute URL base used to render `evidenceUrl` when the assessment has no
   * attached entity. Defaults to a relative `/mm` path.
   */
  baseUrl?: string;
}

export function buildMmEvidence(input: BuildMmEvidenceInput): MmTigerScoreEvidence {
  const a = input.assessment;
  const entity = a.registry.entity;

  const claim = entity
    ? STATUS_CLAIM[entity.status](entity.name)
    : behavioralOnlyClaim(a.engine.confidence);

  const base = input.baseUrl?.replace(/\/$/, "") ?? "";
  const evidenceUrl = entity ? `${base}/mm/${entity.slug}` : `${base}/mm`;

  return {
    type: "MARKET_MAKER_RISK",
    priority: priorityFor(
      a.overall.displayScore,
      a.engine.coverage,
      a.engine.confidence,
    ),
    badge: "MM_FLAG",
    source: "INTERLIGENS_MM_TRACKER",
    claim,
    evidenceUrl,
    scoreImpact: input.scoreImpact,
    mmDisplayScore: a.overall.displayScore,
    mmConfidence: a.engine.confidence,
    mmCoverage: a.engine.coverage,
    mmDominantDriver: a.overall.dominantDriver,
    freshness: a.overall.freshness.staleness,
  };
}
