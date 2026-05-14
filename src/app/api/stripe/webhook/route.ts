// Stripe webhook receiver.
// The brief says the webhook MUST stay reachable even when BILLING_ENABLED=false
// so the Stripe dashboard can test the endpoint before launch — we never gate
// this route on the flag.

import type Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripeClient";
import { logBillingEvent } from "@/lib/billing/auditEvents";
import {
  recordEventIfNew,
  handleCheckoutSessionCompleted,
  handleCheckoutSessionExpired,
  handlePaymentIntentFailed,
  handlePaymentIntentSucceeded,
  handleChargeRefunded,
  handleChargeDisputeCreated,
  handleChargeDisputeClosed,
} from "@/lib/billing/webhookHandlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// `bodyParser` is the pages-router toggle; in app router, just call req.text()
// to get the raw body string with no parsing.

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    await logBillingEvent({
      eventType: "billing.webhook.signature_invalid",
      route: "/api/stripe/webhook",
      metadata: { reason: "no_secret_configured" },
    });
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    await logBillingEvent({
      eventType: "billing.webhook.signature_invalid",
      route: "/api/stripe/webhook",
      metadata: { reason: "missing_signature" },
    });
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    await logBillingEvent({
      eventType: "billing.webhook.signature_invalid",
      route: "/api/stripe/webhook",
      metadata: { reason: "bad_signature", error: shortErr(err) },
    });
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  // Idempotency: drop duplicates as a 200 (Stripe retries 5xx).
  const isNew = await recordEventIfNew(event, payload);
  if (!isNew) {
    await logBillingEvent({
      eventType: "billing.webhook.duplicate",
      route: "/api/stripe/webhook",
      metadata: { stripeEventId: event.id, type: event.type },
    });
    return NextResponse.json({ ok: true, duplicate: true });
  }

  let outcome: string;
  switch (event.type) {
    case "checkout.session.completed":
      outcome = await handleCheckoutSessionCompleted(event);
      break;
    case "checkout.session.expired":
      outcome = await handleCheckoutSessionExpired(event);
      break;
    case "payment_intent.payment_failed":
      outcome = await handlePaymentIntentFailed(event);
      break;
    case "payment_intent.succeeded":
      outcome = await handlePaymentIntentSucceeded(event);
      break;
    case "charge.refunded":
      outcome = await handleChargeRefunded(event);
      break;
    case "charge.dispute.created":
      outcome = await handleChargeDisputeCreated(event);
      break;
    case "charge.dispute.closed":
      outcome = await handleChargeDisputeClosed(event);
      break;
    default:
      outcome = "unhandled";
      await logBillingEvent({
        eventType: "billing.webhook.received",
        route: "/api/stripe/webhook",
        metadata: { stripeEventId: event.id, type: event.type, outcome },
      });
      break;
  }

  return NextResponse.json({ ok: true, outcome });
}

function shortErr(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 200);
  return String(err).slice(0, 200);
}
