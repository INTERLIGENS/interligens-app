import { NextRequest, NextResponse } from "next/server";
import {
  getMmRiskForToken,
  isMmScanBlockEnabled,
} from "@/lib/scan/mmScanIntegration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/scan/mm-risk?address=<address>&chain=<sol|eth|base|arbitrum|bnb|polygon>
 *
 * Thin wrapper around getMmRiskForToken() so the scan page can render the
 * MarketStructureRisk block. Returns { assessment: MmRiskAssessment | null }.
 *
 * When MM_SCAN_BLOCK_LIVE is not "true", returns `{ assessment: null }` fast
 * with no DB hit and no external API calls.
 */
export async function GET(request: NextRequest) {
  if (!isMmScanBlockEnabled()) {
    return NextResponse.json({ assessment: null });
  }

  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address") ?? "";
  const chain = searchParams.get("chain") ?? "";

  if (!address || !chain) {
    return NextResponse.json({ assessment: null });
  }

  const assessment = await getMmRiskForToken(address, chain);
  return NextResponse.json({ assessment });
}
