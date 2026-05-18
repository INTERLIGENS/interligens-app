// src/app/api/v1/wallet-scan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { computeWalletScan, type WalletChain } from "@/lib/wallet-scan/engine";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CHAINS = new Set<WalletChain>(["solana", "ethereum", "base", "arbitrum"]);

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
  const address = typeof b.address === "string" ? b.address.trim() : "";
  const chain = (typeof b.chain === "string" ? b.chain.toLowerCase() : "") as WalletChain;

  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }
  if (!VALID_CHAINS.has(chain)) {
    return NextResponse.json(
      { error: "chain must be one of: solana, ethereum, base, arbitrum" },
      { status: 400 },
    );
  }

  try {
    const result = await computeWalletScan({ address, chain });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        address,
        chain,
        tokenCount: 0,
        tokens: [],
        topRiskLevel: "NONE",
        revokeRecommended: false,
        computed_at: new Date().toISOString(),
        error: "scan_failed",
      },
    );
  }
}
