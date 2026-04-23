// src/app/api/v1/destination-risk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkDestinationRisk, type DestinationChain } from "@/lib/destination-risk/checker";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CHAINS = new Set<DestinationChain>(["solana", "ethereum", "base", "arbitrum"]);

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body required" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const destination = typeof b.destination === "string" ? b.destination.trim() : "";
  const chain = (typeof b.chain === "string" ? b.chain.toLowerCase() : "") as DestinationChain;

  if (!destination) {
    return NextResponse.json({ error: "destination required" }, { status: 400 });
  }
  if (!VALID_CHAINS.has(chain)) {
    return NextResponse.json(
      { error: "chain must be one of: solana, ethereum, base, arbitrum" },
      { status: 400 },
    );
  }

  const amount_usd =
    typeof b.amount_usd === "number" ? b.amount_usd : undefined;
  const token_symbol =
    typeof b.token_symbol === "string" ? b.token_symbol : undefined;

  const result = await checkDestinationRisk({
    destination,
    chain,
    amount_usd,
    token_symbol,
  });

  return NextResponse.json(result);
}
