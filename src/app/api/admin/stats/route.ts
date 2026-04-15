import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import {
  getPlatformStatusStats,
  getFounderKpis,
  getFunnelStats,
  getModuleHealthStats,
  getThreatRadarStats,
  buildStatsAlerts,
} from "@/lib/admin/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const [status, kpis, funnel, modules, radar, alerts] = await Promise.all([
    getPlatformStatusStats(),
    getFounderKpis(),
    getFunnelStats(),
    getModuleHealthStats(),
    getThreatRadarStats(),
    buildStatsAlerts(),
  ]);

  return NextResponse.json({ status, kpis, funnel, modules, radar, alerts });
}
