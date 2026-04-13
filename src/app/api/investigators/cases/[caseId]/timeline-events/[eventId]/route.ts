import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";

type RouteCtx = { params: Promise<{ caseId: string; eventId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteCtx) {
  const { caseId, eventId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const existing = await prisma.vaultTimelineEvent.findUnique({
    where: { id: eventId },
  });
  if (!existing || existing.caseId !== caseId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const data: {
    title?: string;
    description?: string | null;
    eventDate?: Date;
    entityIds?: string[];
  } = {};

  if (typeof body.title === "string") {
    const t = body.title.slice(0, 300).trim();
    if (t) data.title = t;
  }
  if (typeof body.description === "string") {
    data.description = body.description.slice(0, 4000);
  } else if (body.description === null) {
    data.description = null;
  }
  if (body.eventDate) {
    const d = new Date(body.eventDate);
    if (!isNaN(d.getTime())) data.eventDate = d;
  }
  if (Array.isArray(body.entityIds)) {
    data.entityIds = body.entityIds
      .filter((x: unknown): x is string => typeof x === "string")
      .slice(0, 100);
  }

  const event = await prisma.vaultTimelineEvent.update({
    where: { id: eventId },
    data,
  });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "TIMELINE_EVENT_UPDATED",
    actor: ctx.access.label,
    request,
    metadata: { eventId },
  });

  return NextResponse.json({ event });
}

export async function DELETE(request: NextRequest, { params }: RouteCtx) {
  const { caseId, eventId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const existing = await prisma.vaultTimelineEvent.findUnique({
    where: { id: eventId },
  });
  if (!existing || existing.caseId !== caseId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.vaultTimelineEvent.delete({ where: { id: eventId } });

  await logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    caseId,
    action: "TIMELINE_EVENT_DELETED",
    actor: ctx.access.label,
    request,
    metadata: { eventId },
  });

  return NextResponse.json({ ok: true });
}
