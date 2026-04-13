import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVaultWorkspace } from "@/lib/vault/auth.server";

export async function GET(request: NextRequest) {
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const workspaceId = ctx.workspace.id;

    const [activeCases, allCaseIds, openHypotheses] = await Promise.all([
      prisma.vaultCase.count({
        where: { workspaceId, status: { not: "ARCHIVED" } },
      }),
      prisma.vaultCase.findMany({
        where: { workspaceId },
        select: { id: true },
      }),
      prisma.vaultHypothesis
        .count({
          where: {
            status: "OPEN",
            case: { workspaceId },
          },
        })
        .catch(() => 0),
    ]);

    const caseIds = allCaseIds.map((c) => c.id);
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
