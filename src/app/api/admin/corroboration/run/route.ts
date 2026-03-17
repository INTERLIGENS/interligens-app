import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { computeCorroboration, applyCorroborationToLabels } from "@/lib/intake/corroboration";

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const results = await computeCorroboration();
  const updated = await applyCorroborationToLabels();

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
