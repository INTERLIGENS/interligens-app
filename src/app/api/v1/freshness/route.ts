// src/app/api/v1/freshness/route.ts
import { NextRequest, NextResponse } from "next/server";
import { computeFreshnessSignals, type FreshnessInput } from "@/lib/freshness/engine";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAINS = new Set(["solana", "ethereum", "base", "arbitrum"]);

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
  const chain = (b.chain as string | undefined)?.toLowerCase();

  if (!chain || !CHAINS.has(chain)) {
    return NextResponse.json(
      { error: "chain must be one of: solana, ethereum, base, arbitrum" },
      { status: 400 },
    );
  }

  const input: FreshnessInput = {
    chain: chain as FreshnessInput["chain"],
    mint:     typeof b.mint     === "string" ? b.mint     : undefined,
    wallet:   typeof b.wallet   === "string" ? b.wallet   : undefined,
    deployer: typeof b.deployer === "string" ? b.deployer : undefined,
    domain:   typeof b.domain   === "string" ? b.domain   : undefined,
    poolCreatedAt:
      typeof b.poolCreatedAt === "string"
        ? new Date(b.poolCreatedAt)
        : undefined,
  };

  try {
    const result = await computeFreshnessSignals(input);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { severity: "NONE", signals: [], score_contribution: 0, computed_at: new Date() },
    );
  }
}
