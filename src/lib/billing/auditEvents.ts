// Billing audit events: reuses InvestigatorAuditLog with a `billing.*`
// eventType prefix (per audit-billing.md §6 decision). No new model.
//
// Note: InvestigatorAuditLog.investigatorAccessId is nullable, so events
// from anonymous / pre-payment surfaces (checkout creation) are persisted
// with accessId=null and identification carried in `metadata`.

import { prisma } from "@/lib/prisma";

export type BillingEventType =
  | "billing.checkout.created"
  | "billing.checkout.rate_limited"
  | "billing.checkout.turnstile_failed"
  | "billing.checkout.cap_reached"
  | "billing.checkout.idempotent_reuse"
  | "billing.webhook.received"
  | "billing.webhook.signature_invalid"
  | "billing.webhook.duplicate"
  | "billing.payment.completed"
  | "billing.payment.failed"
  | "billing.payment.refunded"
  | "billing.dispute.opened"
  | "billing.dispute.closed"
  | "billing.session.expired"
  | "billing.access.granted"
  | "billing.access.revoked"
  | "billing.fraud.suspect_pattern"
  | "billing.waitlist.added";

export async function logBillingEvent(params: {
  eventType: BillingEventType;
  accessId?: string | null;
  route?: string;
  ipHash?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.investigatorAuditLog.create({
      data: {
        investigatorAccessId: params.accessId ?? null,
        eventType: params.eventType,
        route: params.route ?? null,
        ipHash: params.ipHash ?? null,
        metadata: params.metadata ? (params.metadata as Record<string, string>) : undefined,
      },
    });
  } catch (err) {
    // Audit failures must not break the billing path. Log to stderr only.
    console.error("[billing/auditEvents] failed to persist", params.eventType, err);
  }
}
