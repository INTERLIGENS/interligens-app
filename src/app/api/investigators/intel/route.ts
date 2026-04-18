import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVaultWorkspace } from "@/lib/vault/auth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/investigators/intel
// Read-only list of PUBLIC graphs — the curated Intel Vault surface.
// Only admin review can promote a graph to PUBLIC (see /api/admin/graphs/publish).
export async function GET(request: NextRequest) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const rows = await prisma.vaultNetworkGraph.findMany({
      where: { visibility: "PUBLIC" },
      orderBy: { publishedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        description: true,
        visibility: true,
        nodeCount: true,
        edgeCount: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ graphs: rows });
  } catch (err) {
    console.warn("[intel] list failed", err);
    return NextResponse.json({ graphs: [] });
  }
}
