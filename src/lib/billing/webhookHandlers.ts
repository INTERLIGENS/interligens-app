// Per-event handlers for the Stripe webhook. Each is idempotent and returns
// a short string for telemetry. Never logs the raw Stripe event payload.

import { createHash } from "crypto";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { logBillingEvent } from "./auditEvents";
import { provisionBetaFounderAccess } from "./grantAccess";
import {
  grantEntitlement,
  revokeEntitlementsBySource,
  BETA_FOUNDER_TYPE,
} from "./entitlement";

const CAMPAIGN = "beta_founder_1eur";
const AMOUNT_CENTS = 100;
const CURRENCY = "eur";

export type HandlerOutcome =
  | "ok"
  | "duplicate"
  | "ignored_wrong_campaign"
  | "ignored_wrong_amount"
  | "ignored_wrong_currency"
  | "ignored_unpaid"
  | "no_reservation"
  | "already_processed";

export interface HandlerContext {
  // Allows tests to disable Resend email without mocking the whole module.
  sendEmail?: boolean;
}

/**
 * Records the event id and returns true if this is the first time we see it.
 * Subsequent calls with the same id are a no-op.
 */
export async function recordEventIfNew(event: Pick<Stripe.Event, "id" | "type">, payloadString: string): Promise<boolean> {
  try {
    await prisma.billingEvent.create({
      data: {
        stripeEventId: event.id,
        eventType: event.type,
        payloadHash: createHash("sha256").update(payloadString).digest("hex"),
      },
    });
    return true;
  } catch (err) {
    // Prisma "Unique constraint failed" on stripeEventId → already processed.
    const code = (err as { code?: string }).code;
    if (code === "P2002") return false;
    throw err;
  }
}

export async function handleCheckoutSessionCompleted(
  event: Stripe.Event,
  ctx: HandlerContext = {},
): Promise<HandlerOutcome> {
  const session = event.data.object as Stripe.Checkout.Session;

  // Strict validation: mode, amount, currency, campaign metadata.
  if (session.mode !== "payment") return "ignored_wrong_campaign";
  if (session.metadata?.campaign !== CAMPAIGN) return "ignored_wrong_campaign";
  if (session.payment_status !== "paid") return "ignored_unpaid";
  if (session.amount_total !== AMOUNT_CENTS) return "ignored_wrong_amount";
  if ((session.currency ?? "").toLowerCase() !== CURRENCY) return "ignored_wrong_currency";

  const reservation = await prisma.betaFounderAccess.findUnique({
    where: { stripeCheckoutSession: session.id },
  });
  if (!reservation) {
    await logBillingEvent({
      eventType: "billing.webhook.received",
      metadata: { kind: "checkout.session.completed", reason: "no_reservation", sessionId: session.id },
    });
    return "no_reservation";
  }
  if (reservation.status === "paid") return "already_processed";

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

  const customerCountry =
    session.customer_details?.address?.country ??
    null;
  const taxAmountCents = session.total_details?.amount_tax ?? null;
  const stripeTaxCalculationId =
    (session.metadata?.tax_calculation_id as string | undefined) ?? null;

  // Provision a fresh InvestigatorAccess for the payer (legacy gate keeps working).
  const provision = await provisionBetaFounderAccess({
    email: reservation.email,
    stripeCheckoutSessionId: session.id,
    sendEmail: ctx.sendEmail,
  });

  // Persist the new access id + paid status, and create the Entitlement.
  await prisma.$transaction([
    prisma.betaFounderAccess.update({
      where: { id: reservation.id },
      data: {
        userId: provision.investigatorAccessId,
        status: "paid",
        grantedAt: new Date(),
        stripePaymentIntent: paymentIntentId,
        stripeCustomerId: customerId,
        taxAmountCents,
        customerCountry,
        stripeTaxCalculationId,
      },
    }),
    ...(customerId
      ? [
          prisma.billingCustomer.upsert({
            where: { userId: provision.investigatorAccessId },
            update: { stripeCustomerId: customerId, email: reservation.email },
            create: {
              userId: provision.investigatorAccessId,
              stripeCustomerId: customerId,
              email: reservation.email,
            },
          }),
        ]
      : []),
  ]);

  await grantEntitlement({
    userId: provision.investigatorAccessId,
    type: BETA_FOUNDER_TYPE,
    source: "stripe_checkout",
    sourceId: session.id,
    metadata: { email: reservation.email, campaign: CAMPAIGN },
  });

  await logBillingEvent({
    eventType: "billing.payment.completed",
    accessId: provision.investigatorAccessId,
    metadata: {
      sessionId: session.id,
      paymentIntentId,
      emailDelivered: provision.emailDelivered,
      emailError: provision.emailError ?? null,
      taxAmountCents,
      customerCountry,
    },
  });
  await logBillingEvent({
    eventType: "billing.access.granted",
    accessId: provision.investigatorAccessId,
    metadata: { sessionId: session.id, source: "stripe_checkout" },
  });

  return "ok";
}

export async function handleCheckoutSessionExpired(event: Stripe.Event): Promise<HandlerOutcome> {
  const session = event.data.object as Stripe.Checkout.Session;
  const updated = await prisma.betaFounderAccess.updateMany({
    where: { stripeCheckoutSession: session.id, status: "pending" },
    data: { status: "expired" },
  });
  await logBillingEvent({
    eventType: "billing.session.expired",
    metadata: { sessionId: session.id, updated: updated.count },
  });
  return "ok";
}

export async function handlePaymentIntentFailed(event: Stripe.Event): Promise<HandlerOutcome> {
  const pi = event.data.object as Stripe.PaymentIntent;
  await prisma.betaFounderAccess.updateMany({
    where: { stripePaymentIntent: pi.id, status: { in: ["pending"] } },
    data: { status: "failed" },
  });
  await logBillingEvent({
    eventType: "billing.payment.failed",
    metadata: { paymentIntentId: pi.id, reason: pi.last_payment_error?.code ?? null },
  });
  return "ok";
}

export async function handleChargeRefunded(event: Stripe.Event): Promise<HandlerOutcome> {
  const charge = event.data.object as Stripe.Charge;
  const piId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;
  if (!piId) return "no_reservation";

  const reservation = await prisma.betaFounderAccess.findFirst({
    where: { stripePaymentIntent: piId },
  });
  if (!reservation) return "no_reservation";

  await prisma.betaFounderAccess.update({
    where: { id: reservation.id },
    data: { status: "refunded", revokedAt: new Date(), revokeReason: "refund" },
  });

  if (reservation.stripeCheckoutSession) {
    const r = await revokeEntitlementsBySource({
      source: "stripe_checkout",
      sourceId: reservation.stripeCheckoutSession,
      reason: "refund",
    });
    await logBillingEvent({
      eventType: "billing.payment.refunded",
      accessId: reservation.userId,
      metadata: {
        paymentIntentId: piId,
        sessionId: reservation.stripeCheckoutSession,
        revokedEntitlements: r.revokedCount,
      },
    });
    if (r.revokedCount > 0) {
      await logBillingEvent({
        eventType: "billing.access.revoked",
        accessId: reservation.userId,
        metadata: { reason: "refund", sessionId: reservation.stripeCheckoutSession },
      });
    }
  }
  return "ok";
}

export async function handleChargeDisputeCreated(event: Stripe.Event): Promise<HandlerOutcome> {
  const dispute = event.data.object as Stripe.Dispute;
  const piId =
    typeof dispute.payment_intent === "string"
      ? dispute.payment_intent
      : dispute.payment_intent?.id ?? null;
  if (!piId) return "no_reservation";

  const reservation = await prisma.betaFounderAccess.findFirst({
    where: { stripePaymentIntent: piId },
  });
  if (!reservation) return "no_reservation";

  await prisma.betaFounderAccess.update({
    where: { id: reservation.id },
    data: { status: "disputed", revokedAt: new Date(), revokeReason: "dispute" },
  });

  if (reservation.stripeCheckoutSession) {
    const r = await revokeEntitlementsBySource({
      source: "stripe_checkout",
      sourceId: reservation.stripeCheckoutSession,
      reason: "dispute",
    });
    await logBillingEvent({
      eventType: "billing.dispute.opened",
      accessId: reservation.userId,
      metadata: {
        paymentIntentId: piId,
        disputeId: dispute.id,
        reason: dispute.reason ?? null,
        revokedEntitlements: r.revokedCount,
      },
    });
    if (r.revokedCount > 0) {
      await logBillingEvent({
        eventType: "billing.access.revoked",
        accessId: reservation.userId,
        metadata: { reason: "dispute", sessionId: reservation.stripeCheckoutSession },
      });
    }
  }
  return "ok";
}

export async function handleChargeDisputeClosed(event: Stripe.Event): Promise<HandlerOutcome> {
  const dispute = event.data.object as Stripe.Dispute;
  await logBillingEvent({
    eventType: "billing.dispute.closed",
    metadata: {
      disputeId: dispute.id,
      status: dispute.status,
      reason: dispute.reason ?? null,
    },
  });
  // NO automatic re-activation per spec.
  return "ok";
}

export async function handlePaymentIntentSucceeded(event: Stripe.Event): Promise<HandlerOutcome> {
  const pi = event.data.object as Stripe.PaymentIntent;
  await logBillingEvent({
    eventType: "billing.webhook.received",
    metadata: { kind: "payment_intent.succeeded", paymentIntentId: pi.id },
  });
  // Already handled by checkout.session.completed.
  return "ok";
}
