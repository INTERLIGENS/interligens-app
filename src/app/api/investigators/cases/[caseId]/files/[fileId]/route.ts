import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getVaultWorkspace,
  assertFileOwnership,
  logAudit,
} from "@/lib/vault/auth.server";
import { deleteVaultObject } from "@/lib/vault/r2-vault";

type RouteCtx = { params: Promise<{ caseId: string; fileId: string }> };

export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  const { caseId, fileId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const file = await assertFileOwnership(ctx.workspace.id, caseId, fileId);
  if (file instanceof NextResponse) return file;

  try {
    await deleteVaultObject(file.r2Key);
  } catch (err) {
    console.error("[vault] R2 delete failed", err);
    // fall through — still drop the DB row so the user isn't stuck
  }

  await prisma.vaultCaseEntity.deleteMany({
    where: { caseId, sourceFileId: fileId },
  });
  await prisma.vaultCaseFile.delete({ where: { id: fileId } });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "FILE_DELETED",
    actor: ctx.access.label,
    request,
  });

  return NextResponse.json({ success: true });
}
