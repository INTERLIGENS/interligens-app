import { prisma } from "@/lib/prisma";

export const BETA_FOUNDER_TYPE = "beta_founder_access";

export type EntitlementSource = "stripe_checkout" | "grandfathered" | "manual_admin";

/**
 * Idempotently create an Entitlement for the given (userId, type, source, sourceId).
 * If an active record already exists for that combination, returns it untouched.
 */
export async function grantEntitlement(params: {
  userId: string;
  type: string;
  source: EntitlementSource;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string; created: boolean }> {
  // Look for an existing active row for this exact source pair when one is provided,
  // otherwise for any active row of the same (userId, type) combination.
  const existing = await prisma.entitlement.findFirst({
    where: {
      userId: params.userId,
      type: params.type,
      status: "active",
      revokedAt: null,
      ...(params.sourceId
        ? { source: params.source, sourceId: params.sourceId }
        : {}),
    },
  });
  if (existing) return { id: existing.id, created: false };

  const created = await prisma.entitlement.create({
    data: {
      userId: params.userId,
      type: params.type,
      source: params.source,
      sourceId: params.sourceId ?? null,
      status: "active",
      metadata: params.metadata ? (params.metadata as Record<string, string>) : undefined,
    },
  });
  return { id: created.id, created: true };
}

/**
 * Revoke all active entitlements derived from a given Stripe source (e.g. a
 * checkout session id). Used by refund/dispute webhooks. Idempotent.
 */
export async function revokeEntitlementsBySource(params: {
  source: EntitlementSource;
  sourceId: string;
  reason: string;
}): Promise<{ revokedCount: number }> {
  const now = new Date();
  const res = await prisma.entitlement.updateMany({
    where: {
      source: params.source,
      sourceId: params.sourceId,
      status: "active",
      revokedAt: null,
    },
    data: {
      status: "revoked",
      revokedAt: now,
      revokeReason: params.reason,
    },
  });
  return { revokedCount: res.count };
}

/**
 * Gate check (intentionally NOT used by src/proxy.ts in Phase 1 — see
 * docs/audit-billing.md §"Décision 3 — proxy.ts unchanged"). Provided for
 * Phase 2 + admin/test code.
 */
export async function hasActiveBetaEntitlement(userId: string): Promise<boolean> {
  const now = new Date();
  const row = await prisma.entitlement.findFirst({
    where: {
      userId,
      type: { in: [BETA_FOUNDER_TYPE, "beta_private_access"] },
      status: "active",
      revokedAt: null,
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    select: { id: true },
  });
  return !!row;
}
