import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VaultHypothesisStatus } from "@prisma/client";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";

type RouteCtx = { params: Promise<{ caseId: string }> };

const VALID_STATUS: VaultHypothesisStatus[] = [
  "OPEN",
  "CONFIRMED",
  "REFUTED",
  "NEEDS_VERIFICATION",
];

export async function GET(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  try {
    const hypotheses = await prisma.vaultHypothesis.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ hypotheses });
  } catch (err) {
    console.error("[hypotheses] list failed", err);
    return NextResponse.json({ hypotheses: [] });
  }
}

export async function POST(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.slice(0, 300).trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title_required" }, { status: 400 });
  }
  const statusValue =
    typeof body.status === "string" && VALID_STATUS.includes(body.status as VaultHypothesisStatus)
      ? (body.status as VaultHypothesisStatus)
      : "OPEN";
  const confidence =
    typeof body.confidence === "number" && body.confidence >= 0 && body.confidence <= 100
      ? Math.round(body.confidence)
      : 50;
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 4000) : null;
  const supportingEntityIds = Array.isArray(body.supportingEntityIds)
    ? body.supportingEntityIds.filter((x: unknown): x is string => typeof x === "string").slice(0, 100)
    : [];

  try {
    const hypothesis = await prisma.vaultHypothesis.create({
      data: {
        caseId,
        title,
        status: statusValue,
        confidence,
        notes,
        supportingEntityIds,
      },
    });

    await logAudit({
      investigatorAccessId: ctx.access.id,
      profileId: ctx.profile.id,
      workspaceId: ctx.workspace.id,
      caseId,
      action: "HYPOTHESIS_CREATED",
      actor: ctx.access.label,
      request,
      metadata: { hypothesisId: hypothesis.id },
    });

    return NextResponse.json({ hypothesis });
  } catch (err) {
    console.error("[hypotheses] create failed", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
