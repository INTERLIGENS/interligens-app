import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVaultWorkspace } from "@/lib/vault/auth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/investigators/team-pool
// Read-only list of TEAM_POOL graphs, excluding the caller's own rows (those
// live under /api/investigators/graphs). Payload is NOT returned — the client
// must request /api/investigators/team-pool/[id] to fetch an individual graph.
//
// NOTE: TEAM_POOL payloads are encrypted with the owner's metaKey. A pooled
// graph can only be opened by investigators who share a readable key. The
// key-exchange mechanism is out of scope for this v1; for now pooled graphs
// surface as "metadata-only" on other workspaces.
export async function GET(request: NextRequest) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const rows = await prisma.vaultNetworkGraph.findMany({
      where: {
        visibility: "TEAM_POOL",
        NOT: { workspaceId: ctx.workspace.id },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        description: true,
        visibility: true,
        nodeCount: true,
        edgeCount: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ graphs: rows });
  } catch (err) {
    console.warn("[team-pool] list failed", err);
    return NextResponse.json({ graphs: [] });
  }
}
