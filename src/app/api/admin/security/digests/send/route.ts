import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { sendDigest } from "@/lib/security/email/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/security/digests/send
 *
 * Body (JSON):
 *   { digestId: string, to?: string, from?: string }
 *
 * Sends the digest via Resend using the stored subject/html/text. Updates
 * `deliveryStatus` + `sentAt` + `deliveryMeta` on the row. Idempotent when
 * called twice with the same digestId (subsequent calls overwrite
 * deliveryStatus — useful for manual retry).
 */
export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const digestId = typeof body.digestId === "string" ? body.digestId : "";
  if (!digestId) {
    return NextResponse.json({ error: "digestId required" }, { status: 400 });
  }

  const row = await prisma.securityWeeklyDigest.findUnique({
    where: { id: digestId },
  });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const result = await sendDigest(
    {
      subject: row.subject,
      bodyHtml: row.bodyHtml,
      bodyText: row.bodyText,
      includedIncidentCount: row.includedIncidentCount,
      includedCriticalCount: row.includedCriticalCount,
    },
    { to: body.to, from: body.from },
  );

  await prisma.securityWeeklyDigest.update({
    where: { id: digestId },
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

  return NextResponse.json({ result });
}
