// ─── Admin orchestration for governance operations ───────────────────────
// Thin layer that wraps the persistence functions in src/lib/governance with
// extra admin-specific validation, normalisation and audit logging. Route
// handlers should call these functions — never the persistence ones
// directly.

import {
  getGovernedStatus,
  listGovernedStatus,
  revokeGovernedStatus,
  setGovernedStatus,
  type Actor,
  type EntityType,
  type GovernedStatus,
  type GovernedStatusBasis,
  type GovernedStatusRecord,
  type GovernedStatusReviewState,
  type EvidenceRef,
  type SetGovernedStatusInput,
  type ListGovernedStatusFilters,
} from "@/lib/governance/status";

const ALLOWED_STATUSES: ReadonlySet<GovernedStatus> = new Set([
  "none",
  "watchlisted",
  "suspected",
  "corroborated_high_risk",
  "confirmed_known_bad",
  "authority_flagged",
]);

const ALLOWED_BASES: ReadonlySet<GovernedStatusBasis> = new Set([
  "manual_internal_confirmation",
  "external_authority_source",
  "multi_source_corroboration",
  "legacy_case_linkage",
]);

const ALLOWED_REVIEW_STATES: ReadonlySet<GovernedStatusReviewState> = new Set([
  "draft",
  "reviewed",
  "approved",
]);

export interface AdminSetStatusInput {
  entityType: string;
  entityValue: string;
  chain?: string | null;
  status: string;
  basis?: string | null;
  reason?: string | null;
  reviewState?: string;
  evidenceRefs?: EvidenceRef[];
}

export class AdminGovernanceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "VALIDATION"
      | "NOT_FOUND"
      | "UNAUTHORIZED",
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "AdminGovernanceError";
  }
}

function validateEntityType(t: string): EntityType {
  if (t === "wallet" || t === "token" || t === "domain" || t === "handle") {
    return t;
  }
  throw new AdminGovernanceError(`invalid entityType: ${t}`, "VALIDATION");
}

function validateStatus(s: string): GovernedStatus {
  if (!ALLOWED_STATUSES.has(s as GovernedStatus)) {
    throw new AdminGovernanceError(`invalid status: ${s}`, "VALIDATION");
  }
  return s as GovernedStatus;
}

function validateBasis(b: string | null | undefined): GovernedStatusBasis | null {
  if (b == null) return null;
  if (!ALLOWED_BASES.has(b as GovernedStatusBasis)) {
    throw new AdminGovernanceError(`invalid basis: ${b}`, "VALIDATION");
  }
  return b as GovernedStatusBasis;
}

function validateReviewState(
  s: string | undefined,
): GovernedStatusReviewState | undefined {
  if (!s) return undefined;
  if (!ALLOWED_REVIEW_STATES.has(s as GovernedStatusReviewState)) {
    throw new AdminGovernanceError(`invalid reviewState: ${s}`, "VALIDATION");
  }
  return s as GovernedStatusReviewState;
}

export async function adminSetGovernedStatus(
  input: AdminSetStatusInput,
  actor: Actor,
): Promise<GovernedStatusRecord> {
  const entityType = validateEntityType(input.entityType);
  const status = validateStatus(input.status);
  const basis = validateBasis(input.basis ?? null);
  const reviewState = validateReviewState(input.reviewState);

  if (
    (status === "confirmed_known_bad" || status === "authority_flagged") &&
    !basis
  ) {
    throw new AdminGovernanceError(
      `status ${status} requires basis`,
      "VALIDATION",
    );
  }
  if (!input.entityValue?.trim()) {
    throw new AdminGovernanceError("entityValue required", "VALIDATION");
  }

  const persistInput: SetGovernedStatusInput = {
    entityType,
    entityValue: input.entityValue,
    chain: input.chain ?? null,
    status,
    basis,
    reason: input.reason ?? null,
    reviewState,
    evidenceRefs: input.evidenceRefs ?? [],
  };

  return setGovernedStatus(persistInput, actor);
}

export async function adminRevokeGovernedStatus(
  entityType: string,
  entityValue: string,
  reason: string,
  actor: Actor,
): Promise<GovernedStatusRecord> {
  const et = validateEntityType(entityType);
  if (!reason?.trim()) {
    throw new AdminGovernanceError("reason required", "VALIDATION");
  }
  const existing = await getGovernedStatus(et, entityValue);
  if (!existing) {
    throw new AdminGovernanceError(
      `no governed status for ${entityType}:${entityValue}`,
      "NOT_FOUND",
      404,
    );
  }
  return revokeGovernedStatus(
    { entityType: et, entityValue, reason },
    actor,
  );
}

export async function adminListGovernedStatus(
  filters: Omit<ListGovernedStatusFilters, "entityType" | "reviewState" | "status"> & {
    entityType?: string;
    status?: string;
    reviewState?: string;
  },
): Promise<{ total: number; items: GovernedStatusRecord[] }> {
  const entityType = filters.entityType
    ? validateEntityType(filters.entityType)
    : undefined;
  const status = filters.status ? validateStatus(filters.status) : undefined;
  const reviewState = validateReviewState(filters.reviewState);
  return listGovernedStatus({
    ...filters,
    entityType,
    status,
    reviewState,
  });
}

export async function adminGetGovernedStatus(
  entityType: string,
  entityValue: string,
): Promise<GovernedStatusRecord | null> {
  const et = validateEntityType(entityType);
  return getGovernedStatus(et, entityValue);
}
