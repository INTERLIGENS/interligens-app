import { NextRequest, NextResponse } from "next/server";
import { requireInvestigatorApi } from "@/lib/security/investigatorAuth";

export async function GET(req: NextRequest) {
  const deny = requireInvestigatorApi(req);
  if (deny) return deny;

  try {
    const internal = await fetch(new URL("/api/v1/kol?limit=100", req.nextUrl.origin));
    const data = await internal.json();
    return NextResponse.json({ kols: data.results ?? data.profiles ?? [] });
  } catch {
    return NextResponse.json({ kols: [] });
  }
}
