import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";

type RouteCtx = { params: Promise<{ caseId: string; entityId: string }> };

export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  const { caseId, entityId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const existing = await prisma.vaultCaseEntity.findUnique({
    where: { id: entityId },
  });
  if (!existing || existing.caseId !== caseId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.vaultCaseEntity.delete({ where: { id: entityId } });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "ENTITY_DELETED",
    actor: ctx.access.label,
    request,
    metadata: { entityId, type: existing.type },
  });

  return NextResponse.json({ success: true });
}
