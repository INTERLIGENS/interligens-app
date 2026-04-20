import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/admin/graphs/[id]/publish
// Admin-only. Promotes a graph to PUBLIC (Intel Vault). Also supports
// revert via ?action=unpublish which drops it back to PRIVATE.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const guard = requireAdminApi(request);
  if (guard) return guard;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "publish";
  const body = await request.json().catch(() => ({}));
  const reviewer =
    typeof body.reviewer === "string" && body.reviewer.trim()
      ? body.reviewer.trim().slice(0, 60)
      : "admin";

  if (action !== "publish" && action !== "unpublish") {
    return NextResponse.json(
      { error: "action must be 'publish' or 'unpublish'" },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.vaultNetworkGraph.findUnique({
      where: { id },
      select: { id: true, visibility: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (action === "publish") {
      const updated = await prisma.vaultNetworkGraph.update({
        where: { id },
        data: {
          visibility: "PUBLIC",
          publishedAt: new Date(),
          reviewedBy: reviewer,
        },
        select: {
          id: true,
          title: true,
          visibility: true,
          publishedAt: true,
          reviewedBy: true,
        },
      });
      return NextResponse.json({ graph: updated });
    } else {
      const updated = await prisma.vaultNetworkGraph.update({
        where: { id },
        data: {
          visibility: "PRIVATE",
          publishedAt: null,
          reviewedBy: null,
        },
        select: { id: true, title: true, visibility: true },
      });
      return NextResponse.json({ graph: updated });
    }
  } catch (err) {
    console.error("[admin/graphs/publish] failed", err);
    return NextResponse.json({ error: "publish_failed" }, { status: 500 });
  }
}
