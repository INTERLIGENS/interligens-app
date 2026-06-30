/**
 * src/app/api/admin/osint/review/escalate/route.ts
 *
 * POST — ESCALATE un item (admin-only). Body: { type, id, reason }. Pose un
 * audit action=ESCALATE ; l'item sort de la file standard (le loader l'exclut).
 * N'introduit AUCUN statut, ne publie rien.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/security/adminAuth";
import { verifyMintOnChain } from "@/lib/osint/vision/verifyMintOnChain";
import { escalateItem, buildPrismaReviewStore } from "@/lib/osint/review";
import { auditTableReady, parseRef, failStatus, badRequest } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { type?: unknown; id?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const ref = parseRef(body);
  if (!ref) return badRequest("Body must include valid { type: submission|link|signal, id }");
  if (typeof body.reason !== "string" || !body.reason.trim()) {
    return badRequest("ESCALATE requires a non-empty { reason }");
  }

  const pf = await auditTableReady();
  if (pf) return NextResponse.json({ error: "Migration not applied", detail: pf }, { status: 412 });

  const result = await escalateItem(
    ref,
    { reason: body.reason },
    { store: buildPrismaReviewStore(), verifyMint: verifyMintOnChain, actor: "admin", now: () => new Date().toISOString() },
  );

  return NextResponse.json(result, { status: result.ok ? 200 : failStatus(result.error) });
}
