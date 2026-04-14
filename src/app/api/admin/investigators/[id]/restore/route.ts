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
  const existing = await prisma.investigatorProfile.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const actorId = req.headers.get("x-admin-actor") ?? "admin";

  const nextStatus =
    existing.verificationStatus === "SUSPENDED"
      ? "VERIFIED"
      : existing.verificationStatus;

  await prisma.investigatorProfile.update({
    where: { id },
    data: {
      accessState: "ACTIVE",
      suspendedAt: null,
      suspensionReason: null,
      verificationStatus: nextStatus,
    },
  });

  await prisma.investigatorProgramAuditLog.create({
    data: {
      profileId: id,
      event: "ACCESS_RESTORED",
      actorId,
      metadata: { handle: existing.handle, from: existing.accessState },
    },
  });

  return NextResponse.json({ success: true });
}
