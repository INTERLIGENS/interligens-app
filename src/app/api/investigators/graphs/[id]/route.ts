import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVaultWorkspace, logAudit } from "@/lib/vault/auth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/investigators/graphs/[id]
// Returns the full (encrypted) payload. Only the owner workspace can read.
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const g = await prisma.vaultNetworkGraph.findFirst({
      where: { id, workspaceId: ctx.workspace.id },
    });
    if (!g) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ graph: g });
  } catch (err) {
    console.warn("[graphs/:id] read failed", err);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}

// PATCH /api/investigators/graphs/[id]
// Owner-only update. Can promote PRIVATE → TEAM_POOL. Cannot self-promote
// to PUBLIC — that requires admin review (separate endpoint).
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  let nextVisibility: "PRIVATE" | "TEAM_POOL" | undefined;
  if (typeof body.visibility === "string") {
    if (body.visibility === "PRIVATE" || body.visibility === "TEAM_POOL") {
      nextVisibility = body.visibility;
    } else if (body.visibility === "PUBLIC") {
      return NextResponse.json(
        { error: "Publishing to PUBLIC requires admin review" },
        { status: 403 }
      );
    } else {
      return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.description === "string") data.description = body.description.trim();
  if (typeof body.payloadEnc === "string") data.payloadEnc = body.payloadEnc;
  if (typeof body.payloadIv === "string") data.payloadIv = body.payloadIv;
  if (Number.isFinite(body.nodeCount)) data.nodeCount = Number(body.nodeCount);
  if (Number.isFinite(body.edgeCount)) data.edgeCount = Number(body.edgeCount);
  if (nextVisibility) data.visibility = nextVisibility;

  try {
    const existing = await prisma.vaultNetworkGraph.findFirst({
      where: { id, workspaceId: ctx.workspace.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const updated = await prisma.vaultNetworkGraph.update({
      where: { id },
      data,
      select: { id: true, title: true, visibility: true, updatedAt: true },
    });
    await logAudit({
      investigatorAccessId: ctx.access.id,
      profileId: ctx.profile.id,
      workspaceId: ctx.workspace.id,
      action: "graph.updated",
      actor: ctx.profile.handle,
      request,
      metadata: {
        graphId: id,
        nodeCount: Number.isFinite(body.nodeCount) ? Number(body.nodeCount) : undefined,
        edgeCount: Number.isFinite(body.edgeCount) ? Number(body.edgeCount) : undefined,
        visibilityChange: nextVisibility ?? undefined,
      },
    });
    return NextResponse.json({ graph: updated });
  } catch (err) {
    console.error("[graphs/:id] update failed", err);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

// DELETE — owner only.
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const existing = await prisma.vaultNetworkGraph.findFirst({
      where: { id, workspaceId: ctx.workspace.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await prisma.vaultNetworkGraph.delete({ where: { id } });
    await logAudit({
      investigatorAccessId: ctx.access.id,
      profileId: ctx.profile.id,
      workspaceId: ctx.workspace.id,
      action: "graph.deleted",
      actor: ctx.profile.handle,
      request,
      metadata: { graphId: id },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[graphs/:id] delete failed", err);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
