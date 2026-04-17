// ─── Cron: mm-batch-scan (spec §13.2, Phase 6+) ───────────────────────────
// Placeholder cron. Phase 5 ships only the Registry and the adapter; the
// batch scanner will iterate over watched wallets/tokens, call
// computeMmRiskAssessment for each, and refresh MmScore rows.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  // TODO(phase-6+): iterate over the watch list (wallets + tokens), pull
  //   on-chain data via the data layer, call computeMmRiskAssessment, and
  //   surface the run's counters here.

  return NextResponse.json({
    ok: true,
    status: "placeholder",
    message: "batch scan placeholder — needs data layer",
    phase: 5,
  });
}
