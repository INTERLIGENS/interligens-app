// Strict Stripe Customer lookup, in this order:
//   1) BillingCustomer.userId in our DB
//   2) stripe.customers.search by email
//   3) create new Stripe Customer
// Always upserts BillingCustomer at the end. Never creates two Customers
// for the same identity.

import { prisma } from "@/lib/prisma";
import { getStripe } from "./stripeClient";

export interface LookupInput {
  /** Stable identifier for this INTERLIGENS identity. May be null pre-payment;
   *  in that case we key by email only and do NOT write BillingCustomer until
   *  the webhook back-fills userId. */
  userId: string | null;
  email: string;
}

export interface LookupResult {
  stripeCustomerId: string;
  created: boolean;
}

export async function lookupOrCreateStripeCustomer(input: LookupInput): Promise<LookupResult> {
  const stripe = getStripe();
  const normalizedEmail = input.email.trim().toLowerCase();

  // 1) DB lookup by userId
  if (input.userId) {
    const existing = await prisma.billingCustomer.findUnique({
      where: { userId: input.userId },
    });
    if (existing) {
      return { stripeCustomerId: existing.stripeCustomerId, created: false };
    }
  }

  // 1bis) DB lookup by email as a safety net (in case an earlier attempt
  // created a BillingCustomer with a different userId — e.g. null pre-payment)
  const byEmail = await prisma.billingCustomer.findFirst({
    where: { email: normalizedEmail },
    orderBy: { createdAt: "desc" },
  });
  if (byEmail) {
    return { stripeCustomerId: byEmail.stripeCustomerId, created: false };
  }

  // 2) Stripe search by email
  const search = await stripe.customers.search({
    query: `email:'${escapeSearch(normalizedEmail)}'`,
    limit: 1,
  });
  if (search.data.length > 0) {
    const found = search.data[0];
    await upsertBillingCustomer({ userId: input.userId, stripeCustomerId: found.id, email: normalizedEmail });
    return { stripeCustomerId: found.id, created: false };
  }

  // 3) Create
  const created = await stripe.customers.create({
    email: normalizedEmail,
    metadata: {
      source: "beta_founder_1eur",
      ...(input.userId ? { userId: input.userId } : {}),
    },
  });
  await upsertBillingCustomer({ userId: input.userId, stripeCustomerId: created.id, email: normalizedEmail });
  return { stripeCustomerId: created.id, created: true };
}

async function upsertBillingCustomer(input: {
  userId: string | null;
  stripeCustomerId: string;
  email: string;
}): Promise<void> {
  if (!input.userId) {
    // Pre-payment: we don't have an InvestigatorAccess.id yet. Do not write
    // BillingCustomer; the webhook will, after provisioning the access.
    return;
  }
  await prisma.billingCustomer.upsert({
    where: { userId: input.userId },
    update: { stripeCustomerId: input.stripeCustomerId, email: input.email },
    create: {
      userId: input.userId,
      stripeCustomerId: input.stripeCustomerId,
      email: input.email,
    },
  });
}

/**
 * Stripe Customer Search uses Sigma-like syntax. Escape single quotes by
 * doubling them per Stripe docs.
 */
function escapeSearch(s: string): string {
  return s.replace(/'/g, "\\'");
}
