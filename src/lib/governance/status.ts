// ─── Governance status persistence ────────────────────────────────────────
// Thin, strongly-typed wrapper around the EntityGovernedStatus table. The
// editorial meaning of each status + the labels live in
// src/lib/tigerScore/governedStatus.ts; this module only handles the
// datastore. Single source of truth for:
//   • read (getGovernedStatus)
//   • upsert (setGovernedStatus)
//   • revoke (revokeGovernedStatus)
//   • list / filter (listGovernedStatus)
//
// All writes go through an audit trail via AuditLog. Callers must provide
// an actor.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type EntityType = "wallet" | "token" | "domain" | "handle";

export type GovernedStatus =
  | "none"
  | "watchlisted"
  | "suspected"
  | "corroborated_high_risk"
  | "confirmed_known_bad"
  | "authority_flagged";

export type GovernedStatusBasis =
  | "manual_internal_confirmation"
  | "external_authority_source"
  | "multi_source_corroboration"
  | "legacy_case_linkage";

export type GovernedStatusReviewState = "draft" | "reviewed" | "approved";

export interface EvidenceRef {
  type: string;
  url?: string;
  note?: string;
}

export interface GovernedStatusRecord {
  id: string;
  entityType: EntityType;
  entityValue: string;
  chain: string | null;
  status: GovernedStatus;
  basis: GovernedStatusBasis | null;
  reason: string | null;
  setByUserId: string;
  setByUserRole: string;
  setAt: Date;
  reviewState: GovernedStatusReviewState;
  evidenceRefs: EvidenceRef[];
  revokedAt: Date | null;
  revokedByUserId: string | null;
  revokedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Actor {
  userId: string;
  role?: string;
}

const ENTITY_TYPES: ReadonlySet<EntityType> = new Set([
  "wallet",
  "token",
  "domain",
  "handle",
]);

export function normaliseEntityValue(
  entityType: EntityType,
  raw: string,
): string {
  const trimmed = raw.trim();
  if (entityType === "wallet" || entityType === "token") {
    return trimmed.toLowerCase();
  }
  return trimmed;
}

function castRow(
  row: Awaited<ReturnType<typeof prisma.entityGovernedStatus.findUnique>>,
): GovernedStatusRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    entityType: row.entityType as EntityType,
    entityValue: row.entityValue,
    chain: row.chain,
    status: row.status as GovernedStatus,
    basis: row.basis as GovernedStatusBasis | null,
    reason: row.reason,
    setByUserId: row.setByUserId,
    setByUserRole: row.setByUserRole,
    setAt: row.setAt,
    reviewState: row.reviewState as GovernedStatusReviewState,
    evidenceRefs: (row.evidenceRefs as unknown as EvidenceRef[]) ?? [],
    revokedAt: row.revokedAt,
    revokedByUserId: row.revokedByUserId,
    revokedReason: row.revokedReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  action: string,
  actor: Actor,
  payload: Record<string, unknown>,
) {
  await tx.auditLog.create({
    data: {
      action,
      actorId: actor.userId,
      meta: JSON.stringify({ role: actor.role ?? "admin", ...payload }),
    },
  });
}

// ─── Read ─────────────────────────────────────────────────────────────────

export async function getGovernedStatus(
  entityType: EntityType,
  entityValue: string,
): Promise<GovernedStatusRecord | null> {
  if (!ENTITY_TYPES.has(entityType)) {
    throw new Error(`getGovernedStatus: invalid entityType ${entityType}`);
  }
  const normalised = normaliseEntityValue(entityType, entityValue);
  const row = await prisma.entityGovernedStatus.findUnique({
    where: {
      entityType_entityValue: { entityType, entityValue: normalised },
    },
  });
  return castRow(row);
}

// ─── Upsert ───────────────────────────────────────────────────────────────

export interface SetGovernedStatusInput {
  entityType: EntityType;
  entityValue: string;
  chain?: string | null;
  status: GovernedStatus;
  basis?: GovernedStatusBasis | null;
  reason?: string | null;
  reviewState?: GovernedStatusReviewState;
  evidenceRefs?: EvidenceRef[];
}

export async function setGovernedStatus(
  input: SetGovernedStatusInput,
  actor: Actor,
): Promise<GovernedStatusRecord> {
  if (!ENTITY_TYPES.has(input.entityType)) {
    throw new Error(`setGovernedStatus: invalid entityType ${input.entityType}`);
  }
  const normalised = normaliseEntityValue(input.entityType, input.entityValue);
  if (!normalised) throw new Error("setGovernedStatus: entityValue required");

  // Spec §11 from governedStatus.ts — the two strongest tiers require explicit
  // manual or authoritative source. `basis` is mandatory for them.
  if (
    (input.status === "confirmed_known_bad" ||
      input.status === "authority_flagged") &&
    !input.basis
  ) {
    throw new Error(
      `setGovernedStatus: status ${input.status} requires an explicit basis`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const row = await tx.entityGovernedStatus.upsert({
      where: {
        entityType_entityValue: {
          entityType: input.entityType,
          entityValue: normalised,
        },
      },
      update: {
        status: input.status,
        basis: input.basis ?? null,
        reason: input.reason ?? null,
        chain: input.chain ?? null,
        reviewState: input.reviewState ?? "draft",
        evidenceRefs: (input.evidenceRefs ??
          []) as unknown as Prisma.InputJsonValue,
        setByUserId: actor.userId,
        setByUserRole: actor.role ?? "admin",
        setAt: new Date(),
        revokedAt: null,
        revokedByUserId: null,
        revokedReason: null,
      },
      create: {
        entityType: input.entityType,
        entityValue: normalised,
        chain: input.chain ?? null,
        status: input.status,
        basis: input.basis ?? null,
        reason: input.reason ?? null,
        reviewState: input.reviewState ?? "draft",
        evidenceRefs: (input.evidenceRefs ??
          []) as unknown as Prisma.InputJsonValue,
        setByUserId: actor.userId,
        setByUserRole: actor.role ?? "admin",
      },
    });

    await writeAudit(tx, "governance.status.set", actor, {
      entityType: input.entityType,
      entityValue: normalised,
      chain: input.chain ?? null,
      status: input.status,
      basis: input.basis ?? null,
      reviewState: input.reviewState ?? "draft",
    });

    return castRow(row)!;
  });
}

// ─── Revoke ───────────────────────────────────────────────────────────────

export interface RevokeGovernedStatusInput {
  entityType: EntityType;
  entityValue: string;
  reason: string;
}

export async function revokeGovernedStatus(
  input: RevokeGovernedStatusInput,
  actor: Actor,
): Promise<GovernedStatusRecord> {
  if (!input.reason?.trim()) {
    throw new Error("revokeGovernedStatus: reason required");
  }
  const normalised = normaliseEntityValue(input.entityType, input.entityValue);
  return prisma.$transaction(async (tx) => {
    const row = await tx.entityGovernedStatus.update({
      where: {
        entityType_entityValue: {
          entityType: input.entityType,
          entityValue: normalised,
        },
      },
      data: {
        status: "none",
        revokedAt: new Date(),
        revokedByUserId: actor.userId,
        revokedReason: input.reason.trim(),
      },
    });
    await writeAudit(tx, "governance.status.revoke", actor, {
      entityType: input.entityType,
      entityValue: normalised,
      reason: input.reason.trim(),
    });
    return castRow(row)!;
  });
}

// ─── List / search ────────────────────────────────────────────────────────

export interface ListGovernedStatusFilters {
  status?: GovernedStatus;
  entityType?: EntityType;
  reviewState?: GovernedStatusReviewState;
  chain?: string;
  limit?: number;
  offset?: number;
  includeRevoked?: boolean;
}

export async function listGovernedStatus(
  filters: ListGovernedStatusFilters = {},
): Promise<{ total: number; items: GovernedStatusRecord[] }> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  const where: Prisma.EntityGovernedStatusWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.reviewState ? { reviewState: filters.reviewState } : {}),
    ...(filters.chain ? { chain: filters.chain } : {}),
    ...(filters.includeRevoked ? {} : { revokedAt: null }),
  };

  const [total, rows] = await Promise.all([
    prisma.entityGovernedStatus.count({ where }),
    prisma.entityGovernedStatus.findMany({
      where,
      orderBy: { setAt: "desc" },
      skip: offset,
      take: limit,
    }),
  ]);
  return {
    total,
    items: rows
      .map((r) => castRow(r))
      .filter((x): x is GovernedStatusRecord => x !== null),
  };
}

export { ENTITY_TYPES };
