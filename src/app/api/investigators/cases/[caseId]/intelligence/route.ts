import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVaultWorkspace, assertCaseOwnership } from "@/lib/vault/auth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ caseId: string }> };

// GET /api/investigators/cases/[caseId]/intelligence
// Returns recent events + the latest summary projection. Events and summary
// payloads are plaintext — they reference encrypted entity IDs but never
// contain decrypted case content.
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  try {
    const [events, summary] = await Promise.all([
      prisma.vaultCaseIntelligenceEvent.findMany({
        where: { caseId, isDismissed: false },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          entityId: true,
          eventType: true,
          sourceModule: true,
          severity: true,
          title: true,
          summary: true,
          confidence: true,
          payload: true,
          createdAt: true,
        },
      }),
      prisma.vaultCaseIntelligenceSummary.findUnique({
        where: { caseId },
        select: {
          strongestSignals: true,
          currentGaps: true,
          nextSuggestedActions: true,
          latestEventIds: true,
          lastOrchestratedAt: true,
          orchestrationStatus: true,
          lastFailedModules: true,
          updatedAt: true,
        },
      }),
    ]);

    return NextResponse.json({ events, summary });
  } catch (err) {
    // Table may not exist yet pre-migration — fail soft.
    console.warn("[intelligence] fetch failed", err);
    return NextResponse.json({ events: [], summary: null });
  }
}

// PATCH /api/investigators/cases/[caseId]/intelligence
// Body: { dismissEventId }
// Soft-dismisses a single event so it stops showing in the feed.
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  const body = await request.json().catch(() => ({}));
  const id =
    typeof body.dismissEventId === "string" ? body.dismissEventId : null;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  try {
    await prisma.vaultCaseIntelligenceEvent.updateMany({
      where: { id, caseId },
      data: { isDismissed: true },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[intelligence] dismiss failed", err);
    return NextResponse.json({ error: "dismiss_failed" }, { status: 500 });
  }
}
