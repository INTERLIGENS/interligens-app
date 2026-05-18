// ─── Cron: mm-calibration (spec §7.6) ─────────────────────────────────────
// Recompute MmCohortPercentile rows from a rolling sample of observed
// metrics per cohort. Phase 3 ships the infrastructure (calibrator + cache)
// but the sample gathering requires the Phase 5+ data layer (helius,
// etherscan, birdeye). Until that exists this route returns a stable 200
// placeholder so the cron schedule can be wired without breaking deploys.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO(phase-5): iterate over all cohort keys with enough observed tokens,
  //   fetch raw metrics via the data layer (helius/birdeye/etherscan),
  //   call calibrateCohort(cohortKey, inputs) for each, and report totals.
  //
  //   For now the route is intentionally a no-op so the cron can be
  //   scheduled in vercel.json without risk.

  return NextResponse.json({
    ok: true,
    status: "placeholder",
    message: "calibration cron placeholder — needs data layer",
    phase: 3,
  });
}
