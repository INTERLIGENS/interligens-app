import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";
import { base64ToArrayBuffer } from "@/lib/vault/crypto-node";

type RouteCtx = { params: Promise<{ caseId: string }> };

export async function GET(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const notes = await prisma.vaultCaseNote.findMany({
    where: { caseId },
    orderBy: { createdAt: "desc" },
    // contentEnc + contentIv returned as-is. The server never decrypts them.
    select: {
      id: true,
      contentEnc: true,
      contentIv: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "NOTES_ACCESSED",
    actor: ctx.access.label,
    request,
  });

  return NextResponse.json({ notes });
}

export async function POST(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const body = await request.json().catch(() => ({}));
  const { contentEnc, contentIv } = body as Record<string, string>;
  if (!contentEnc || !contentIv) {
    return NextResponse.json({ error: "missing_ciphertext" }, { status: 400 });
  }
  const ivBytes = base64ToArrayBuffer(contentIv);
  if (ivBytes.byteLength !== 12) {
    return NextResponse.json({ error: "bad_iv_length" }, { status: 400 });
  }

  const created = await prisma.vaultCaseNote.create({
    data: { caseId, contentEnc, contentIv },
  });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "NOTE_CREATED",
    actor: ctx.access.label,
    request,
  });

  return NextResponse.json({ id: created.id, createdAt: created.createdAt });
}
