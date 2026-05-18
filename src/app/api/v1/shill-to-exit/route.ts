// src/app/api/v1/shill-to-exit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { computeShillToExitResult } from "@/lib/shill-to-exit/engine";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY_RESULT = {
  detected: false,
  confidence: "NONE" as const,
  kolHandle: "",
  timeline: [],
  total_proceeds_usd: 0,
  max_delta_minutes: 0,
};

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { searchParams } = req.nextUrl;
  const handle = (searchParams.get("handle") ?? "").replace(/^@+/, "").trim();
  const mint = searchParams.get("mint") ?? undefined;
  const symbol = searchParams.get("symbol") ?? undefined;

  if (!handle) {
    return NextResponse.json(
      { ...EMPTY_RESULT, error: "handle required" },
      { status: 400 },
    );
  }

  try {
    const result = await computeShillToExitResult({
      kolHandle: handle,
      tokenMint: mint,
      tokenSymbol: symbol,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { ...EMPTY_RESULT, kolHandle: handle, computed_at: new Date() },
    );
  }
}
