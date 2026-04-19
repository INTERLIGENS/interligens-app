import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVaultWorkspace, logAudit } from "@/lib/vault/auth.server";
import { buildFingerprint } from "@/lib/vault/fingerprint.server";

export async function GET(request: NextRequest) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Fire-and-forget — metrics endpoint is read-only but carries session intent.
  void logAudit({
    investigatorAccessId: ctx.access.id,
    profileId: ctx.profile.id,
    workspaceId: ctx.workspace.id,
    action: "WORKSPACE_METRICS_VIEWED",
    actor: ctx.access.label,
    request,
    fingerprint: buildFingerprint(request),
  });

  try {
    const workspaceId = ctx.workspace.id;

    const [activeCases, activeCaseRows, openHypotheses] = await Promise.all([
      prisma.vaultCase.count({
        where: { workspaceId, status: { not: "ARCHIVED" } },
      }),
      prisma.vaultCase.findMany({
        where: { workspaceId, status: { not: "ARCHIVED" } },
        select: { id: true },
      }),
      prisma.vaultHypothesis
        .count({
          where: {
            status: "OPEN",
            case: { workspaceId, status: { not: "ARCHIVED" } },
          },
        })
        .catch(() => 0),
    ]);

    // trackedEntities must reflect the same scope as the case list (non-archived).
    const caseIds = activeCaseRows.map((c) => c.id);
    const trackedEntities =
      caseIds.length === 0
        ? 0
        : await prisma.vaultCaseEntity.count({
            where: { caseId: { in: caseIds } },
          });

    // Approximate "publish-ready": case with >= 3 entities AND >= 1 hypothesis
    let publishReadyCases = 0;
    if (caseIds.length > 0) {
      const entityCountsPerCase = await prisma.vaultCaseEntity.groupBy({
        by: ["caseId"],
        where: { caseId: { in: caseIds } },
        _count: { _all: true },
      });
      const casesWith3Plus = new Set(
        entityCountsPerCase
          .filter((g) => g._count._all >= 3)
          .map((g) => g.caseId)
      );
      if (casesWith3Plus.size > 0) {
        const hypCounts = await prisma.vaultHypothesis
          .groupBy({
            by: ["caseId"],
            where: { caseId: { in: Array.from(casesWith3Plus) } },
            _count: { _all: true },
          })
          .catch(() => []);
        publishReadyCases = hypCounts.filter((g) => g._count._all >= 1).length;
      }
    }

    return NextResponse.json({
      activeCases,
      trackedEntities,
      openHypotheses,
      publishReadyCases,
    });
  } catch (err) {
    console.error("[workspace/metrics] failed", err);
    return NextResponse.json({
      activeCases: 0,
      trackedEntities: 0,
      openHypotheses: 0,
      publishReadyCases: 0,
    });
  }
}
