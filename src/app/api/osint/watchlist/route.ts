import { NextResponse } from "next/server";
import { DEMO_WATCHLIST } from "@/lib/osint/watchlist";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    count: DEMO_WATCHLIST.length,
    hero: DEMO_WATCHLIST.filter((e) => e.hero),
    all: DEMO_WATCHLIST,
    mode: process.env.OSINT_MODE ?? "fixtures",
  }, { headers: { "Cache-Control": "public, s-maxage=60" } });
}
