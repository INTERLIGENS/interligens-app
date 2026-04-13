import { NextRequest, NextResponse } from "next/server";
import {
  getVaultWorkspace,
  assertCaseOwnership,
} from "@/lib/vault/auth.server";
import { buildCaseIntelligencePack } from "@/lib/vault/buildCaseIntelligencePack";

type RouteCtx = { params: Promise<{ caseId: string }> };

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

export async function GET(request: NextRequest, { params }: RouteCtx) {
  const { caseId } = await params;
  const ctx = await getVaultWorkspace(request);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = await assertCaseOwnership(ctx.workspace.id, caseId);
  if (owner instanceof NextResponse) return owner;

  try {
    const pack = await buildCaseIntelligencePack(caseId, ctx.workspace.id);

    const kolMatches = pack.entities.filter(
      (e) => e.crossIntelligence.inKolRegistry
    ).length;

    const proceedsTotal = pack.entities.reduce((sum, e) => {
      return sum + (e.crossIntelligence.proceedsSummary?.totalUSD ?? 0);
    }, 0);

    return NextResponse.json({
      entityCount: pack.entityCount,
      kolMatches,
      proceedsTotal: proceedsTotal > 0 ? formatUSD(proceedsTotal) : "$0",
      networkActors: pack.networkIntelligence.relatedActors.length,
      laundryTrails: pack.entities.filter(
        (e) => e.crossIntelligence.laundryTrail?.detected
      ).length,
      intelVaultRefs: pack.intelVaultRefs.length,
      confidenceClaims: pack.confidenceAssessment.length,
      contradictions: pack.contradictions.length,
      timelineSpan: pack.timelineCorrelation.timespan,
    });
  } catch (err) {
    console.error("[intelligence-summary] failed", err);
    return NextResponse.json({
      entityCount: 0,
      kolMatches: 0,
      proceedsTotal: "$0",
      networkActors: 0,
      laundryTrails: 0,
      intelVaultRefs: 0,
      confidenceClaims: 0,
      contradictions: 0,
      timelineSpan: null,
    });
  }
}
