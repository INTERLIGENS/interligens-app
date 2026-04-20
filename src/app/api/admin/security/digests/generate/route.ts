import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { buildDigest } from "@/lib/security/email/digest";
import { buildDigestInputForPeriod } from "@/lib/security/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/security/digests/generate
 *
 * Body (optional JSON):
 *   { periodStart?: ISO, periodEnd?: ISO }
 * Defaults: last 7 days ending now.
 *
 * Composes + persists a `SecurityWeeklyDigest` row with status=pending. Does
 * NOT send — call `/send` afterwards (or use the cron).
 */
export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const now = new Date();
  const periodEnd = body.periodEnd ? new Date(body.periodEnd) : now;
  const periodStart = body.periodStart
    ? new Date(body.periodStart)
    : new Date(periodEnd.getTime() - 7 * 24 * 3600 * 1000);

  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return NextResponse.json({ error: "invalid_period" }, { status: 400 });
  }

  const input = await buildDigestInputForPeriod(periodStart, periodEnd);
  const digest = buildDigest(input);

  const row = await prisma.securityWeeklyDigest.create({
    data: {
      periodStart,
      periodEnd,
      subject: digest.subject,
      bodyHtml: digest.bodyHtml,
      bodyText: digest.bodyText,
      includedIncidentCount: digest.includedIncidentCount,
      includedCriticalCount: digest.includedCriticalCount,
      deliveryStatus: "pending",
    },
  });

  return NextResponse.json({ digest: row });
}
