import { NextRequest, NextResponse } from "next/server";
import { applyCorroborationToLabels, computeCorroboration } from "@/lib/intake/corroboration";

export const runtime = "nodejs";
export const maxDuration = 300; // SEC-010
export const dynamic = "force-dynamic";


// Vercel Cron: runs every 24 hours
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results  = await computeCorroboration();
  const updated  = await applyCorroborationToLabels();

  return NextResponse.json({
    ok: true,
    corroboratedAddresses: results.length,
    labelsElevated:        updated,
    top10: results.slice(0, 10).map(r => ({
      address:       r.address,
      chain:         r.chain,
      evidenceCount: r.evidenceCount,
      confidence:    r.confidence,
    })),
  });
}
