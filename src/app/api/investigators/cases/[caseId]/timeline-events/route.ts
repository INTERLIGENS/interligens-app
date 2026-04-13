import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getVaultWorkspace,
  assertCaseOwnership,
  logAudit,
} from "@/lib/vault/auth.server";

type RouteCtx = { params: Promise<{ caseId: string }> };

export async function GET(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  try {
    const events = await prisma.vaultTimelineEvent.findMany({
      where: { caseId },
      orderBy: { eventDate: "asc" },
    });
    return NextResponse.json({ events });
  } catch (err) {
    console.error("[timeline-events] list failed", err);
    return NextResponse.json({ events: [] });
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
  const description =
    typeof body.description === "string" ? body.description.slice(0, 4000) : null;
  const eventDateRaw = body.eventDate;
  const entityIds = Array.isArray(body.entityIds)
    ? body.entityIds
        .filter((x: unknown): x is string => typeof x === "string")
        .slice(0, 100)
    : [];

  if (!title) {
    return NextResponse.json({ error: "title_required" }, { status: 400 });
  }
  const eventDate = new Date(eventDateRaw);
  if (isNaN(eventDate.getTime())) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  try {
    const event = await prisma.vaultTimelineEvent.create({
      data: { caseId, title, description, eventDate, entityIds },
    });

    await logAudit({
      investigatorAccessId: ctx.access.id,
      profileId: ctx.profile.id,
      workspaceId: ctx.workspace.id,
      caseId,
      action: "TIMELINE_EVENT_CREATED",
      actor: ctx.access.label,
      request,
      metadata: { eventId: event.id },
    });

    return NextResponse.json({ event });
  } catch (err) {
    console.error("[timeline-events] create failed", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
