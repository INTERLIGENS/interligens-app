// /access/founder — entry point for the €1 Beta Founder offer.
// Server component: reads BILLING_ENABLED + cap state, then renders a client
// form. Exempt from the proxy gate per src/proxy.ts (path starts with /access).

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isBillingEnabled, isCapOverrideReached, getCap } from "@/lib/billing/env";
import { prisma } from "@/lib/prisma";
import { detectLocaleFromHeader } from "./copy";
import FounderClient from "./FounderClient";

export const dynamic = "force-dynamic";

export default async function FounderPage() {
  if (!isBillingEnabled()) notFound();

  const h = await headers();
  const locale = detectLocaleFromHeader(h.get("accept-language"));

  const cap = getCap();
  const reached = isCapOverrideReached() || (await currentReservedCount()) >= cap;

  return (
    <FounderClient
      initialLocale={locale}
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
      soldOut={reached}
    />
  );
}

async function currentReservedCount(): Promise<number> {
  const now = new Date();
  const n = await prisma.betaFounderAccess.count({
    where: {
      OR: [
        { status: "paid" },
        { status: "pending", reservationExpiresAt: { gt: now } },
      ],
    },
  });
  return n;
}
