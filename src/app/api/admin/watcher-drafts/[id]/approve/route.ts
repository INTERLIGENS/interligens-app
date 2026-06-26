// POST /api/admin/watcher-drafts/:id/approve — make a draft KolTokenLink public.
// Admin-only: same admin_session cookie as the /admin/watcher-drafts page.
import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminSession } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { approveDraftLink } from "@/lib/watcher-bridge/reviewDraftLink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const result = await approveDraftLink(prisma, id, "admin");

  const status =
    result.action === "approved" || result.action === "noop_already_public" ? 200
    : result.action === "blocked_checklist" ? 422
    : result.action === "not_draft" ? 409
    : 404;
  return NextResponse.json(result, { status });
}
