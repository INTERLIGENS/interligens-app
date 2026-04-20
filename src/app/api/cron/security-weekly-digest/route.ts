import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildDigest, sendDigest } from "@/lib/security/email/digest";
import { buildDigestInputForPeriod } from "@/lib/security/queries";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/security-weekly-digest
 *
 * Gated by CRON_SECRET — accepted either as `Authorization: Bearer <secret>`
 * (Vercel cron default) or as `x-cron-secret` header.
 *
 * Composes a digest for the past 7 days, persists it, sends via Resend,
 * updates delivery status. Never throws — records the failure on the row.
 *
 * Schedule (vercel.json): "0 8 * * 1"  (Monday 08:00 UTC).
 *  - ~10:00 Europe/Paris en été (CEST = UTC+2) → 08:00 UTC = 10:00 Paris.
 *  - ~09:00 Europe/Paris en hiver (CET = UTC+1) → 08:00 UTC = 09:00 Paris.
 * V2 : cron timezone-aware via double-fire + filtre horaire.
 */
function verifyCronSecret(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET ?? "";
  if (!expected) return false;
  const header =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    req.headers.get("x-cron-secret") ||
    "";
  if (!header) return false;
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(header);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 3600 * 1000);

  let digestRow;
  try {
    const input = await buildDigestInputForPeriod(periodStart, periodEnd);
    const composed = buildDigest(input);

    digestRow = await prisma.securityWeeklyDigest.create({
      data: {
        periodStart,
        periodEnd,
        subject: composed.subject,
        bodyHtml: composed.bodyHtml,
        bodyText: composed.bodyText,
        includedIncidentCount: composed.includedIncidentCount,
        includedCriticalCount: composed.includedCriticalCount,
        deliveryStatus: "pending",
      },
    });

    const result = await sendDigest(composed);

    await prisma.securityWeeklyDigest.update({
      where: { id: digestRow.id },
      data: {
        deliveryStatus: result.delivered
          ? "sent"
          : result.skipped
            ? "pending"
            : "failed",
        sentAt: result.delivered ? new Date() : null,
        deliveryMeta: (result as unknown) as object,
      },
    });

    return NextResponse.json({ ok: true, digestId: digestRow.id, result });
  } catch (err) {
    console.error("[cron/security-weekly-digest] failed", err);
    if (digestRow?.id) {
      await prisma.securityWeeklyDigest
        .update({
          where: { id: digestRow.id },
          data: {
            deliveryStatus: "failed",
            deliveryMeta: {
              error: err instanceof Error ? err.message : String(err),
            },
          },
        })
        .catch(() => {});
    }
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
