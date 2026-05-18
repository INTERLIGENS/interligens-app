// src/app/api/v1/watch/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const email  = typeof b.email  === "string" ? b.email.trim().toLowerCase()  : null;
  const mint   = typeof b.mint   === "string" ? b.mint.trim()                 : null;
  const chain  = typeof b.chain  === "string" ? b.chain.trim().toUpperCase()  : null;
  const symbol = typeof b.symbol === "string" ? b.symbol.slice(0, 20)         : undefined;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!mint) return NextResponse.json({ error: "mint required" }, { status: 400 });
  if (!chain) return NextResponse.json({ error: "chain required" }, { status: 400 });

  try {
    const { addWatch } = await import("@/lib/watch/engine");
    await addWatch(email, mint, chain, symbol);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[watch] addWatch failed", err);
    return NextResponse.json({ error: "Could not save watch" }, { status: 500 });
  }
}
