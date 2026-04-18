import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVaultWorkspace } from "@/lib/vault/auth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/investigators/graphs
// Returns the investigator's PRIVATE + TEAM_POOL graphs (their own rows only).
// Payload (encrypted JSON) is NOT returned here — use the /[id] route for it.
export async function GET(request: NextRequest) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const rows = await prisma.vaultNetworkGraph.findMany({
      where: { workspaceId: ctx.workspace.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        visibility: true,
        nodeCount: true,
        edgeCount: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ graphs: rows });
  } catch (err) {
    // Table may not exist yet pre-migration — fail soft so the dashboard
    // doesn't red-bar for every investigator until Neon is migrated.
    console.warn("[graphs] list failed", err);
    return NextResponse.json({ graphs: [] });
  }
}

// POST /api/investigators/graphs
// Create a new PRIVATE graph. Payload is client-side encrypted.
export async function POST(request: NextRequest) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : null;
  const payloadEnc = typeof body.payloadEnc === "string" ? body.payloadEnc : "";
  const payloadIv = typeof body.payloadIv === "string" ? body.payloadIv : "";
  const nodeCount = Number.isFinite(body.nodeCount) ? Number(body.nodeCount) : 0;
  const edgeCount = Number.isFinite(body.edgeCount) ? Number(body.edgeCount) : 0;

  if (!title || !payloadEnc || !payloadIv) {
    return NextResponse.json(
      { error: "title, payloadEnc and payloadIv are required" },
      { status: 400 }
    );
  }

  try {
    const created = await prisma.vaultNetworkGraph.create({
      data: {
        workspaceId: ctx.workspace.id,
        title,
        description,
        payloadEnc,
        payloadIv,
        nodeCount,
        edgeCount,
        // visibility defaults to PRIVATE
      },
      select: {
        id: true,
        title: true,
        visibility: true,
        nodeCount: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ graph: created }, { status: 201 });
  } catch (err) {
    console.error("[graphs] create failed", err);
    return NextResponse.json(
      { error: "Graph storage not available yet — run the Neon migration first." },
      { status: 503 }
    );
  }
}
