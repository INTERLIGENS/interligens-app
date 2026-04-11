/**
 * Retail Vision Phase 6F-4 — Admin-only Wayback search route.
 *
 *   GET /api/admin/wayback/search?url={url}&limit={1-100}
 *
 * Auth: requireAdminApi (x-admin-token header or admin_token cookie).
 *
 * Returns the raw list of Wayback captures as JSON. Intended for
 * manual investigator use — no cron, no queueing, no automation.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { searchArchivedPage, getOldestCapture } from "@/lib/osint/wayback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "missing ?url=" }, { status: 400 });
  }

  const limitRaw = Number(searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;

  const captures = await searchArchivedPage(url, limit);
  const oldest = captures[0] ?? (await getOldestCapture(url));

  return NextResponse.json({
    url,
    count: captures.length,
    oldest,
    captures,
    note: "Wayback is an investigator tool — do not automate or expose to retail.",
  });
}
