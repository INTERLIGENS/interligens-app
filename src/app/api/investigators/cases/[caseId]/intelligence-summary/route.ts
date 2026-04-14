import { NextRequest, NextResponse } from "next/server";
import {
  getVaultWorkspace,
  assertCaseOwnership,
} from "@/lib/vault/auth.server";
import {
  checkRateLimit,
  rateLimitExceededBody,
} from "@/lib/vault/rateLimit.server";
import { buildCaseIntelligenceSummary } from "@/lib/vault/buildCaseIntelligencePack";

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

  const rl = checkRateLimit(
    ctx.workspace.id,
    "intelligence_summary_read",
    100,
    3600_000,
  );
  if (!rl.allowed) {
    return NextResponse.json(
      rateLimitExceededBody(rl, "Intelligence summary"),
      { status: 429 },
    );
  }

  try {
    const summary = await buildCaseIntelligenceSummary(
      caseId,
      ctx.workspace.id
    );

    return NextResponse.json({
      entityCount: summary.entityCount,
      kolMatches: summary.kolMatches,
      proceedsTotal:
        summary.proceedsTotal > 0 ? formatUSD(summary.proceedsTotal) : "$0",
      networkActors: summary.networkActors,
      laundryTrails: summary.laundryTrails,
      intelVaultRefs: summary.intelVaultRefs,
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
    });
  }
}
