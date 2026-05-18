import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBillingEnabled, getAppUrl, isStripeTaxEnabled } from "@/lib/billing/env";
import { getStripe } from "@/lib/billing/stripeClient";
import { verifyTurnstile } from "@/lib/billing/turnstile";
import { checkCheckoutRateLimits } from "@/lib/billing/rateLimit";
import { checkCap } from "@/lib/billing/cap";
import { lookupOrCreateStripeCustomer } from "@/lib/billing/customerLookup";
import { checkoutIdempotencyKey } from "@/lib/billing/idempotency";
import { logBillingEvent } from "@/lib/billing/auditEvents";
import { getClientIp, hashIp, isValidEmail, normalizeEmail } from "@/lib/billing/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAMPAIGN = "beta_founder_1eur";
const AMOUNT_CENTS = 100;
const CURRENCY = "eur";
const RESERVATION_MINUTES = 30;

export async function POST(req: NextRequest) {
  if (!isBillingEnabled()) return notFound();

  let body: { email?: string; turnstileToken?: string };
  try {
    body = (await req.json()) as { email?: string; turnstileToken?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const normalizedEmail = normalizeEmail(email);

  const ip = getClientIp(req);
  const ipHash = hashIp(ip);

  // Turnstile
  const tsResult = await verifyTurnstile(body.turnstileToken, ip);
  if (!tsResult.ok) {
    await logBillingEvent({
      eventType: "billing.checkout.turnstile_failed",
      ipHash,
      route: "/api/billing/create-checkout-session",
      metadata: { reason: tsResult.reason, email: normalizedEmail },
    });
    return NextResponse.json({ error: "turnstile_failed" }, { status: 400 });
  }

  // Rate limit
  const rl = await checkCheckoutRateLimits({ ip, email: normalizedEmail });
  if (!rl.ok) {
    await logBillingEvent({
      eventType: "billing.checkout.rate_limited",
      ipHash,
      route: "/api/billing/create-checkout-session",
      metadata: { email: normalizedEmail, resetAt: rl.resetAt },
    });
    return NextResponse.json(
      { error: "rate_limited", resetAt: rl.resetAt },
      { status: 429, headers: { "Retry-After": String(Math.max(1, rl.resetAt - Math.floor(Date.now() / 1000))) } },
    );
  }

  // Idempotence — reuse an existing non-expired pending reservation if any.
  const now = new Date();
  const existing = await prisma.betaFounderAccess.findFirst({
    where: {
      email: normalizedEmail,
      status: "pending",
      reservationExpiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing?.stripeCheckoutSessionUrl) {
    await logBillingEvent({
      eventType: "billing.checkout.idempotent_reuse",
      ipHash,
      route: "/api/billing/create-checkout-session",
      metadata: { email: normalizedEmail, reservationId: existing.id },
    });
    return NextResponse.json({ url: existing.stripeCheckoutSessionUrl });
  }
  // Sweep stale pending into 'expired' so cap counting is accurate.
  await prisma.betaFounderAccess.updateMany({
    where: {
      email: normalizedEmail,
      status: "pending",
      reservationExpiresAt: { lte: now },
    },
    data: { status: "expired" },
  });

  // Atomic cap check + reservation insert in a transaction.
  let reservationId: string;
  try {
    reservationId = await prisma.$transaction(async (tx) => {
      const cap = await checkCap({ tx });
      if (!cap.allowed) {
        const err = new Error("cap");
        (err as { code?: string }).code = cap.reason; // sold_out or override
        throw err;
      }
      const created = await tx.betaFounderAccess.create({
        data: {
          email: normalizedEmail,
          status: "pending",
          campaign: CAMPAIGN,
          amountCents: AMOUNT_CENTS,
          currency: CURRENCY,
          reservationExpiresAt: new Date(now.getTime() + RESERVATION_MINUTES * 60_000),
        },
      });
      return created.id;
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "sold_out" || code === "override") {
      await logBillingEvent({
        eventType: "billing.checkout.cap_reached",
        ipHash,
        route: "/api/billing/create-checkout-session",
        metadata: { email: normalizedEmail, reason: code },
      });
      return NextResponse.json({ error: "sold_out" }, { status: 409 });
    }
    throw err;
  }

  // Stripe Customer (pre-payment we only key by email)
  const customer = await lookupOrCreateStripeCustomer({ userId: null, email: normalizedEmail });

  const stripe = getStripe();
  const appUrl = getAppUrl();

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer: customer.stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: CURRENCY,
            unit_amount: AMOUNT_CENTS,
            product_data: { name: "INTERLIGENS Beta Founder Access" },
          },
          quantity: 1,
        },
      ],
      automatic_tax: { enabled: isStripeTaxEnabled() },
      payment_method_types: ["card"],
      // Apple Pay / Google Pay surface automatically when card is enabled and
      // the dashboard wallets/domains are configured.
      success_url: `${appUrl}/access/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/access/founder`,
      metadata: {
        campaign: CAMPAIGN,
        accessType: "beta_founder",
        reservationId,
        email: normalizedEmail,
      },
      expires_at: Math.floor((now.getTime() + RESERVATION_MINUTES * 60_000) / 1000),
    },
    {
      idempotencyKey: checkoutIdempotencyKey({ userIdOrEmail: normalizedEmail, nowMs: now.getTime() }),
    },
  );

  await prisma.betaFounderAccess.update({
    where: { id: reservationId },
    data: {
      stripeCheckoutSession: session.id,
      stripeCheckoutSessionUrl: session.url ?? null,
      stripeCustomerId: customer.stripeCustomerId,
    },
  });

  await logBillingEvent({
    eventType: "billing.checkout.created",
    ipHash,
    route: "/api/billing/create-checkout-session",
    metadata: { reservationId, sessionId: session.id, email: normalizedEmail },
  });

  if (!session.url) {
    return NextResponse.json({ error: "stripe_no_url" }, { status: 502 });
  }
  return NextResponse.json({ url: session.url });
}

function notFound() {
  // Per spec: when the flag is off, the route must look unavailable.
  return new NextResponse("Not Found", { status: 404 });
}
