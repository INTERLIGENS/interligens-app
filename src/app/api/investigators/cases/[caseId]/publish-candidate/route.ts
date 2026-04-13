import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";

type RouteCtx = { params: Promise<{ caseId: string }> };

export async function POST(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const body = await request.json().catch(() => ({}));
  const entityIds = Array.isArray(body.entityIds)
    ? body.entityIds
        .filter((x: unknown): x is string => typeof x === "string")
        .slice(0, 500)
    : [];
  const summary =
    typeof body.summary === "string" ? body.summary.slice(0, 4000).trim() : "";

  if (!summary || summary.length < 100) {
    return NextResponse.json(
      { error: "summary_too_short" },
      { status: 400 }
    );
  }
  if (entityIds.length === 0) {
    return NextResponse.json(
      { error: "no_entities_selected" },
      { status: 400 }
    );
  }

  // Validate all entity IDs belong to this case
  const validEntities = await prisma.vaultCaseEntity.findMany({
    where: { caseId, id: { in: entityIds } },
    select: { id: true },
  });
  const validIds = validEntities.map((e) => e.id);
  if (validIds.length === 0) {
    return NextResponse.json({ error: "no_valid_entities" }, { status: 400 });
  }

  try {
    const submission = await prisma.vaultPublishCandidate.create({
      data: {
        caseId,
        entityIds: validIds,
        summary,
      },
    });

    await logAudit({
      investigatorAccessId: ctx.access.id,
      profileId: ctx.profile.id,
      workspaceId: ctx.workspace.id,
      caseId,
      action: "PUBLISH_SUBMITTED",
      actor: ctx.access.label,
      request,
      metadata: {
        submissionId: submission.id,
        entityCount: validIds.length,
      },
    });

    return NextResponse.json({ success: true, submissionId: submission.id });
  } catch (err) {
    console.error("[publish-candidate] create failed", err);
    return NextResponse.json({ error: "submission_failed" }, { status: 500 });
  }
}
