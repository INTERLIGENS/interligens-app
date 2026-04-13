import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromReq,
  validateSession,
} from "@/lib/security/investigatorAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

// ── DELETE /api/watch/[id] ─────────────────────────────────────────────────
// Soft delete — sets active = false. Ownership enforced via accessId match.
export async function DELETE(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const token = getSessionTokenFromReq(req);
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await validateSession(token);
  if (!session)
    return NextResponse.json({ error: "Session expired" }, { status: 401 });

  const existing = await prisma.watchedAddress.findUnique({
    where: { id },
    select: { id: true, ownerAccessId: true },
  });
  if (!existing || existing.ownerAccessId !== session.accessId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.watchedAddress.update({
    where: { id },
    data: { active: false },
  });

  return NextResponse.json({ success: true });
}
