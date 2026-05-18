// Polling endpoint for /access/success. Returns the high-level status of a
// reservation given its Stripe Checkout Session id. Authorization is by the
// session_id itself (signed by Stripe in the success_url and not enumerable),
// plus a soft email match — we never expose access codes here.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBillingEnabled } from "@/lib/billing/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isBillingEnabled()) return new NextResponse("Not Found", { status: 404 });

  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  }

  const row = await prisma.betaFounderAccess.findUnique({
    where: { stripeCheckoutSession: sessionId },
    select: {
      status: true,
      email: true,
      grantedAt: true,
      revokedAt: true,
    },
  });
  if (!row) {
    return NextResponse.json({ status: "unknown" });
  }
  return NextResponse.json({
    status: row.status,
    emailHint: maskEmail(row.email),
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt,
  });
}

function maskEmail(e: string): string {
  const [user, host] = e.split("@");
  if (!user || !host) return "***";
  const u = user.length <= 2 ? user[0] + "*" : user.slice(0, 2) + "***";
  return `${u}@${host}`;
}
