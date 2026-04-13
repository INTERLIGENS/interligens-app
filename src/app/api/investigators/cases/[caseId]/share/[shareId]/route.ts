import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";

type RouteCtx = { params: Promise<{ caseId: string; shareId: string }> };

export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  const { caseId, shareId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const existing = await prisma.vaultCaseShare.findUnique({
    where: { id: shareId },
    select: { caseId: true },
  });
  if (!existing || existing.caseId !== caseId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.vaultCaseShare.update({
    where: { id: shareId },
    data: { expiresAt: new Date() },
  });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "CASE_SHARE_REVOKED",
    actor: ctx.access.label,
    request,
    metadata: { shareId },
  });

  return NextResponse.json({ success: true });
}
