import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VaultHypothesisStatus } from "@prisma/client";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";

type RouteCtx = {
  params: Promise<{ caseId: string; hypothesisId: string }>;
};

const VALID_STATUS: VaultHypothesisStatus[] = [
  "OPEN",
  "CONFIRMED",
  "REFUTED",
  "NEEDS_VERIFICATION",
];

export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  const { caseId, hypothesisId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const existing = await prisma.vaultHypothesis.findUnique({
    where: { id: hypothesisId },
  });
  if (!existing || existing.caseId !== caseId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const data: {
    title?: string;
    status?: VaultHypothesisStatus;
    confidence?: number;
    notes?: string | null;
  } = {};

  if (typeof body.title === "string") {
    const t = body.title.slice(0, 300).trim();
    if (t) data.title = t;
  }
  if (typeof body.status === "string" && VALID_STATUS.includes(body.status as VaultHypothesisStatus)) {
    data.status = body.status as VaultHypothesisStatus;
  }
  if (typeof body.confidence === "number" && body.confidence >= 0 && body.confidence <= 100) {
    data.confidence = Math.round(body.confidence);
  }
  if (typeof body.notes === "string") {
    data.notes = body.notes.slice(0, 4000);
  } else if (body.notes === null) {
    data.notes = null;
  }

  const hypothesis = await prisma.vaultHypothesis.update({
    where: { id: hypothesisId },
    data,
  });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "HYPOTHESIS_UPDATED",
    actor: ctx.access.label,
    request,
    metadata: { hypothesisId },
  });

  return NextResponse.json({ hypothesis });
}

export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  const { caseId, hypothesisId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const existing = await prisma.vaultHypothesis.findUnique({
    where: { id: hypothesisId },
  });
  if (!existing || existing.caseId !== caseId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.vaultHypothesis.delete({ where: { id: hypothesisId } });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "HYPOTHESIS_DELETED",
    actor: ctx.access.label,
    request,
    metadata: { hypothesisId },
  });

  return NextResponse.json({ ok: true });
}
