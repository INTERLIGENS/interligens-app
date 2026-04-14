/**
 * POST /api/admin/intel/run
 * Manually triggers the RSS ingestion pipeline. Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { runRssIngest } from "@/lib/intel/rss-ingester";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  try {
    const result = await runRssIngest();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin/intel/run] failed", err);
    return NextResponse.json({ ok: false, error: "ingest_failed" }, { status: 500 });
  }
}
