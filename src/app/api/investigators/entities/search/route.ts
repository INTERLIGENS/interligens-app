import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVaultWorkspace, logAudit } from "@/lib/vault/auth.server";

export async function GET(request: NextRequest) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 3) {
    return NextResponse.json({ results: [] });
  }

  try {
    const matches = await prisma.vaultCaseEntity.findMany({
      where: {
        case: { workspaceId: ctx.workspace.id },
        OR: [
          { value: { contains: q, mode: "insensitive" } },
          { label: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        type: true,
        value: true,
        label: true,
        tigerScore: true,
        caseId: true,
        case: {
          select: {
            id: true,
            titleEnc: true,
            titleIv: true,
          },
        },
      },
      take: 20,
      orderBy: { createdAt: "desc" },
    });

    await logAudit({
      investigatorAccessId: ctx.access.id,
      profileId: ctx.profile.id,
      workspaceId: ctx.workspace.id,
      action: "ENTITIES_SEARCHED",
      actor: ctx.access.label,
      request,
      metadata: { query: q, results: matches.length },
    });

    return NextResponse.json({
      results: matches.map((m) => ({
        entityId: m.id,
        type: m.type,
        value: m.value,
        label: m.label,
        tigerScore: m.tigerScore,
        caseId: m.caseId,
        caseTitleEnc: m.case.titleEnc,
        caseTitleIv: m.case.titleIv,
      })),
    });
  } catch (err) {
    console.error("[entities/search] failed", err);
    return NextResponse.json({ results: [] });
  }
}
