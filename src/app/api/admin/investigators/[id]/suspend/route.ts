import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "";

  if (!reason) {
    return NextResponse.json({ error: "Reason required" }, { status: 400 });
  }

  const existing = await prisma.investigatorProfile.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const actorId = req.headers.get("x-admin-actor") ?? "admin";

  await prisma.investigatorProfile.update({
    where: { id },
    data: {
      accessState: "SUSPENDED",
      verificationStatus: "SUSPENDED",
      suspendedAt: new Date(),
      suspensionReason: reason,
    },
  });

  await prisma.investigatorProgramAuditLog.create({
    data: {
      profileId: id,
      event: "ACCESS_SUSPENDED",
      actorId,
      metadata: { handle: existing.handle, reason },
    },
  });

  return NextResponse.json({ success: true });
}
