// POST /api/admin/watcher-drafts/:id/reject — mark a draft KolTokenLink rejected.
// Admin-only. Body: { reason: string } — REQUIRED.
import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminSession } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { rejectDraftLink } from "@/lib/watcher-bridge/reviewDraftLink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let reason = "";
  try {
    const body = (await req.json()) as { reason?: unknown };
    if (typeof body?.reason === "string") reason = body.reason;
  } catch {
    // no/invalid body → reason stays empty → rejected below
  }

  const result = await rejectDraftLink(prisma, id, "admin", reason);

  const status =
    result.action === "rejected" || result.action === "noop_already_rejected" ? 200
    : result.action === "missing_reason" ? 400
    : result.action === "not_draft" ? 409
    : 404;
  return NextResponse.json(result, { status });
}
