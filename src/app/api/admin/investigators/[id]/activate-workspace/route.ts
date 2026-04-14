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

  const now = new Date();
  const actorId = req.headers.get("x-admin-actor") ?? "admin";

  const updated = await prisma.investigatorProfile.update({
    where: { id },
    data: {
      accessLevel: "BETA",
      accessState: "ACTIVE",
      verificationStatus: "VERIFIED",
      workspaceActivatedAt: existing.workspaceActivatedAt ?? now,
      approvedAt: existing.approvedAt ?? now,
      approvedBy: existing.approvedBy ?? actorId,
    },
  });

  await prisma.investigatorProgramAuditLog.create({
    data: {
      profileId: id,
      event: "WORKSPACE_ACTIVATED",
      actorId,
      metadata: { handle: existing.handle },
    },
  });

  return NextResponse.json({ success: true, profile: updated });
}
