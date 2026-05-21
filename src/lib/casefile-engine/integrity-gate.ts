/**
 * Casefile Engine V1 — Evidence Integrity Gate.
 *
 * Each exhibit must satisfy a minimum of 9 fields before the casefile draft is
 * considered "evidence-package-complete". If any of the 9 fields is missing
 * on any exhibit, the gate blocks (returns ok=false) and lists every missing
 * field per exhibit. Additionally, when the draft is flagged as an escalation
 * pack (escalationPack === true), each exhibit must also satisfy 7 CEX-specific
 * fields used for exchange escalation.
 *
 * Implementation note: this file was authored from the audit checklist
 * (9 blocking fields + 7 CEX escalation fields). The PROMPT marker
 * "comme dans le draft précédent" did not include the draft itself.
 */

export const MINIMUM_EXHIBIT_FIELDS = [
  "exhibitId",
  "type",
  "description",
  "source",
  "dateCollected",
  "collectionMethod",
  "hashSha256",
  "storageUri",
  "redactionStatus",
] as const;

export const ESCALATION_PACK_FIELDS = [
  "originalFilename",
  "relevance",
  "attributionLevel",
  "sourceReliability",
  "admissibilityRisk",
  "chainOfCustodyNotes",
  "cexTouchpointReference",
] as const;

export type ExhibitField = (typeof MINIMUM_EXHIBIT_FIELDS)[number];
export type EscalationField = (typeof ESCALATION_PACK_FIELDS)[number];

export interface ExhibitLike {
  exhibitId?: unknown;
  [k: string]: unknown;
}

export interface IntegrityIssue {
  exhibitId: string;
  missing: string[];
}

export interface IntegrityGateResult {
  ok: boolean;
  blockedReason?: "no-exhibits" | "missing-fields";
  issues: IntegrityIssue[];
  totalExhibitsChecked: number;
}

function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export interface RunIntegrityGateOptions {
  escalationPack?: boolean;
}

export function runIntegrityGate(
  exhibits: ExhibitLike[] | undefined,
  options: RunIntegrityGateOptions = {},
): IntegrityGateResult {
  const list = Array.isArray(exhibits) ? exhibits : [];
  if (list.length === 0) {
    return {
      ok: false,
      blockedReason: "no-exhibits",
      issues: [],
      totalExhibitsChecked: 0,
    };
  }

  const requiredFields: readonly string[] = options.escalationPack
    ? [...MINIMUM_EXHIBIT_FIELDS, ...ESCALATION_PACK_FIELDS]
    : MINIMUM_EXHIBIT_FIELDS;

  const issues: IntegrityIssue[] = [];
  for (const ex of list) {
    const missing: string[] = [];
    for (const field of requiredFields) {
      if (!isPresent(ex[field])) missing.push(field);
    }
    if (missing.length > 0) {
      issues.push({
        exhibitId:
          typeof ex.exhibitId === "string" && ex.exhibitId.trim().length > 0
            ? ex.exhibitId
            : "<missing-exhibitId>",
        missing,
      });
    }
  }

  return {
    ok: issues.length === 0,
    blockedReason: issues.length === 0 ? undefined : "missing-fields",
    issues,
    totalExhibitsChecked: list.length,
  };
}
