import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";
import { base64ToArrayBuffer } from "@/lib/vault/crypto-node";

type RouteCtx = { params: Promise<{ caseId: string; noteId: string }> };

async function assertNote(caseId: string, noteId: string) {
  const n = await prisma.vaultCaseNote.findFirst({
    where: { id: noteId, caseId },
    select: { id: true },
  });
  return n;
}

export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  const { caseId, noteId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;
  const note = await assertNote(caseId, noteId);
  if (!note) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { contentEnc, contentIv } = body as Record<string, string>;
  if (!contentEnc || !contentIv) {
    return NextResponse.json({ error: "missing_ciphertext" }, { status: 400 });
  }
  if (base64ToArrayBuffer(contentIv).byteLength !== 12) {
    return NextResponse.json({ error: "bad_iv_length" }, { status: 400 });
  }

  const updated = await prisma.vaultCaseNote.update({
    where: { id: noteId },
    data: { contentEnc, contentIv },
    select: { id: true, updatedAt: true },
  });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "NOTE_UPDATED",
    actor: ctx.access.label,
    request,
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  const { caseId, noteId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;
  const note = await assertNote(caseId, noteId);
  if (!note) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.vaultCaseNote.delete({ where: { id: noteId } });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "NOTE_DELETED",
    actor: ctx.access.label,
    request,
  });

  return NextResponse.json({ success: true });
}
