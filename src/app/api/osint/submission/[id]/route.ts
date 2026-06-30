/**
 * src/app/api/osint/submission/[id]/route.ts
 *
 * SPRINT C1 — GET /api/osint/submission/:id (PUBLIQUE, STATUT SEUL).
 *
 * Renvoie UNIQUEMENT le statut d'un batch (QUEUED / PROCESSING / PENDING_REVIEW /
 * AUTO_COMMITTED_SHADOW / PRECHECK_REJECTED / DUPLICATE / ...). AUCUNE donnée
 * sensible : pas de CA, pas d'evidence, pas de handle, pas de raison interne fine.
 * Le précheckReason (format/taille) est exposé car non sensible et utile au
 * soumetteur. Next.js 16 : params est une Promise.
 */

import { NextRequest, NextResponse } from "next/server";
import { getBatchStatusRows } from "@/lib/osint/retail/retailStore";
import { aggregateBatchStatus } from "@/lib/osint/retail/submitGate";
import { SubmissionStatus } from "@/lib/osint/contracts";
import type { SubmissionStatus as SubmissionStatusT } from "@/lib/osint/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  let rows;
  try {
    rows = await getBatchStatusRows(id);
  } catch {
    // Table/colonnes non provisionnées → on ne révèle rien, simple 404.
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!rows.length) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const aggregate = aggregateBatchStatus(rows.map((r) => r.status as SubmissionStatusT));
  return NextResponse.json({
    submissionId: id,
    status: aggregate,
    images: rows.map((r) => ({
      index: r.imageIndex,
      status: r.status,
      // précheckReason seulement si rejet précheck (non sensible).
      rejectReason: r.status === SubmissionStatus.PRECHECK_REJECTED ? r.precheckReason : null,
    })),
  });
}
