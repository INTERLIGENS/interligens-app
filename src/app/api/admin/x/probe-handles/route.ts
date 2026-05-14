import { NextRequest, NextResponse } from "next/server";
import { getUserByUsername, hasToken } from "@/lib/xapi/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type ProbeResult = {
  handle: string;
  id: string | null;
  name: string | null;
  status: "ok" | "not_found";
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  // The /api/admin/* middleware already enforces Basic Auth (or admin
  // session cookie). The Authorization header is consumed there, so route
  // handlers use x-admin-token for the second layer.
  const token = req.headers.get("x-admin-token") ?? "";
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasToken()) {
    return NextResponse.json({ error: "X_BEARER_TOKEN not configured" }, { status: 500 });
  }

  let body: { handles?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }
  const handles = body.handles;
  if (!Array.isArray(handles) || handles.length === 0) {
    return NextResponse.json({ error: "handles must be a non-empty array" }, { status: 400 });
  }
  if (handles.length > 50) {
    return NextResponse.json({ error: "max 50 handles per request" }, { status: 400 });
  }
  if (!handles.every((h) => typeof h === "string" && h.length > 0 && h.length <= 30)) {
    return NextResponse.json({ error: "each handle must be a non-empty string <=30 chars" }, { status: 400 });
  }

  const results: ProbeResult[] = [];
  for (const handle of handles as string[]) {
    const user = await getUserByUsername(handle);
    if (user) {
      results.push({ handle, id: user.id, name: user.name, status: "ok" });
    } else {
      results.push({ handle, id: null, name: null, status: "not_found" });
    }
    await sleep(1_000);
  }

  return NextResponse.json({ count: results.length, results });
}
