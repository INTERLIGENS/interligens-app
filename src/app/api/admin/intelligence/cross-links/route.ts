// GET /api/admin/intelligence/cross-links
// Returns all KolCrossLink rows, optionally filtered by ?handle=xxx
// Auth: requireAdminApi

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { getCrossLinks } from "@/lib/intelligence/crossCaseLinker";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const handle = req.nextUrl.searchParams.get("handle") ?? undefined;

  try {
    const links = await getCrossLinks(handle);
    return NextResponse.json({ links, total: links.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
