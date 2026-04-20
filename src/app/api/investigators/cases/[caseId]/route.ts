import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VaultCaseStatus } from "@prisma/client";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";
import { buildFingerprint } from "@/lib/vault/fingerprint.server";

type RouteCtx = { params: Promise<{ caseId: string }> };

export async function GET(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const c = await prisma.vaultCase.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      titleEnc: true,
      titleIv: true,
      tagsEnc: true,
      tagsIv: true,
      status: true,
      caseTemplate: true,
      createdAt: true,
      updatedAt: true,
      archivedAt: true,
      _count: { select: { entities: true, files: true, notes: true } },
    },
  });
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "CASE_VIEWED",
    actor: ctx.access.label,
    request,
    fingerprint: buildFingerprint(request),
  });

  return NextResponse.json({
    case: {
      id: c.id,
      titleEnc: c.titleEnc,
      titleIv: c.titleIv,
      tagsEnc: c.tagsEnc,
      tagsIv: c.tagsIv,
      status: c.status,
      caseTemplate: c.caseTemplate,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      archivedAt: c.archivedAt,
      entityCount: c._count.entities,
      fileCount: c._count.files,
      noteCount: c._count.notes,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const body = await request.json().catch(() => ({}));
  const { titleEnc, titleIv, tagsEnc, tagsIv, status } = body as Record<
    string,
    string
  >;
  const data: Record<string, unknown> = {};
  if (typeof titleEnc === "string" && typeof titleIv === "string") {
    data.titleEnc = titleEnc;
    data.titleIv = titleIv;
  }
  if (typeof tagsEnc === "string" && typeof tagsIv === "string") {
    data.tagsEnc = tagsEnc;
    data.tagsIv = tagsIv;
  }
  if (
    status === "PRIVATE" ||
    status === "SHARED_INTERNAL" ||
    status === "SUBMITTED" ||
    status === "ARCHIVED"
  ) {
    data.status = status as VaultCaseStatus;
    if (status === "ARCHIVED") data.archivedAt = new Date();
  }

  const updated = await prisma.vaultCase.update({
    where: { id: caseId },
    data,
  });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "CASE_UPDATED",
    actor: ctx.access.label,
    request,
  });

  return NextResponse.json({
    id: updated.id,
    titleEnc: updated.titleEnc,
    titleIv: updated.titleIv,
    tagsEnc: updated.tagsEnc,
    tagsIv: updated.tagsIv,
    status: updated.status,
    archivedAt: updated.archivedAt,
  });
}

/**
 * Hard-delete a case and everything it owns.
 *
 * Ownership is derived server-side from the session via getVaultWorkspace
 * + assertCaseOwnership — we NEVER trust a client-sent profileId. Cascade
 * deletes (declared in the Prisma schema on VaultCaseEntity / File / Note
 * / Timeline / Hypothesis / TimelineEvent / PublishCandidate) remove the
 * children automatically. VaultAuditLog entries referencing this caseId
 * intentionally remain: they have a nullable caseId and audit trails must
 * survive the resource they describe.
 */
export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  // Audit BEFORE the delete so the log survives even if cascade fails.
  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "CASE_DELETED",
    actor: ctx.access.label,
    request,
    fingerprint: buildFingerprint(request),
  });

  try {
    await prisma.vaultCase.delete({ where: { id: caseId } });
  } catch (err) {
    console.error("[investigators/cases] delete failed", err);
    return NextResponse.json(
      { error: "delete_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
