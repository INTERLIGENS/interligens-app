/**
 * src/app/api/admin/osint/review/resolve/route.ts
 *
 * POST — RESOLVE un item de la file de revue (admin-only, SHADOW).
 * Body: { type, id, contractAddress, chain, reason }.
 * La CA saisie est RE-VÉRIFIÉE on-chain (Helius) via verifyMintOnChain avant
 * acceptation. Si le mint n'existe pas → 422, l'item reste pending. Si OK →
 * état traité shadow (RESOLVED_BY_REVIEW / resolved / pending_review draft).
 * AUCUNE publication : jamais isPublic=true ni visibility='public'.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/security/adminAuth";
import { verifyMintOnChain } from "@/lib/osint/vision/verifyMintOnChain";
import { resolveItem, buildPrismaReviewStore } from "@/lib/osint/review";
import { auditTableReady, parseRef, failStatus, badRequest } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { type?: unknown; id?: unknown; contractAddress?: unknown; chain?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const ref = parseRef(body);
  if (!ref) return badRequest("Body must include valid { type: submission|link|signal, id }");
  if (typeof body.contractAddress !== "string" || typeof body.chain !== "string") {
    return badRequest("RESOLVE requires { contractAddress, chain }");
  }

  const pf = await auditTableReady();
  if (pf) return NextResponse.json({ error: "Migration not applied", detail: pf }, { status: 412 });

  const result = await resolveItem(
    ref,
    { contractAddress: body.contractAddress, chain: body.chain, reason: typeof body.reason === "string" ? body.reason : "" },
    { store: buildPrismaReviewStore(), verifyMint: verifyMintOnChain, actor: "admin", now: () => new Date().toISOString() },
  );

  return NextResponse.json(result, { status: result.ok ? 200 : failStatus(result.error) });
}
