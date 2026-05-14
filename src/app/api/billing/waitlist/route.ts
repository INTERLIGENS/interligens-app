import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBillingEnabled } from "@/lib/billing/env";
import { verifyTurnstile } from "@/lib/billing/turnstile";
import { checkWaitlistRateLimit } from "@/lib/billing/rateLimit";
import { logBillingEvent } from "@/lib/billing/auditEvents";
import { getClientIp, hashIp, isValidEmail, normalizeEmail } from "@/lib/billing/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isBillingEnabled()) return new NextResponse("Not Found", { status: 404 });

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

  const ts = await verifyTurnstile(body.turnstileToken, ip);
  if (!ts.ok) {
    return NextResponse.json({ error: "turnstile_failed" }, { status: 400 });
  }

  const rl = await checkWaitlistRateLimit({ ip, email: normalizedEmail });
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    await prisma.waitlistEntry.create({
      data: { email: normalizedEmail, source: "beta_founder_soldout" },
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "P2002") throw err;
    // Already on the waitlist — pretend success so we don't leak membership.
  }

  await logBillingEvent({
    eventType: "billing.waitlist.added",
    ipHash,
    route: "/api/billing/waitlist",
    metadata: { email: normalizedEmail },
  });

  return NextResponse.json({ ok: true });
}
