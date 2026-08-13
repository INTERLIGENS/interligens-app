import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/solanaGraph/scheduler";
import { vaultLookup } from "@/lib/vault/vaultLookup";
import { checkScanLimit } from "@/lib/vault/scanRateLimit";
import { auditScanLookup } from "@/lib/vault/auditScan";
import { getClientIp, rateLimitResponse, detectLocale } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // checkScanLimit était importé ici mais JAMAIS appelé : le polling de statut
  // n'avait aucun limiteur. Non authentifié, et le proxy exempte /api/*.
  // 20 req / 1 min / IP, fail-open (lecture seule, pas de coût externe).
  const rl = await checkScanLimit(getClientIp(req));
  if (!rl.allowed) return rateLimitResponse(rl, detectLocale(req));

  const { id } = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json(job);
}
