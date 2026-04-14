/**
 * GET /api/investigators/shill-timeline?handle=X
 * Returns shill-to-exit signals for a given KOL handle. Investigator-gated.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/lib/security/investigatorAuth";
import { detectShillToExit } from "@/lib/shill-to-exit/detector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "investigator_session";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value ?? null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await validateSession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const handle = (url.searchParams.get("handle") ?? "").trim().replace(/^@+/, "");
  if (!handle) return NextResponse.json({ error: "handle required" }, { status: 400 });

  try {
    const signals = await detectShillToExit(handle);
    return NextResponse.json({ ok: true, handle, signals });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
