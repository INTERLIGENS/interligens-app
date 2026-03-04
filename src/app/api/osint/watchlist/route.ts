import { NextResponse } from "next/server";
import { DEMO_WATCHLIST } from "@/lib/osint/watchlist";
import { checkAuth } from "@/lib/security/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const _auth = await checkAuth(req);
  if (!_auth.authorized) return _auth.response!;
  return NextResponse.json({
    count: DEMO_WATCHLIST.length,
    hero: DEMO_WATCHLIST.filter((e) => e.hero),
    all: DEMO_WATCHLIST,
    mode: process.env.OSINT_MODE ?? "fixtures",
  }, { headers: { "Cache-Control": "public, s-maxage=60" } });
}
