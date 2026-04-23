// src/app/api/v1/off-chain/route.ts
import { NextRequest, NextResponse } from "next/server";
import { computeOffChainCredibility } from "@/lib/off-chain-credibility/engine";
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
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body required" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  const websiteUrl    = typeof b.websiteUrl    === "string" ? b.websiteUrl    : undefined;
  const githubUrl     = typeof b.githubUrl     === "string" ? b.githubUrl     : undefined;
  const twitterHandle = typeof b.twitterHandle === "string" ? b.twitterHandle : undefined;
  const telegramUrl   = typeof b.telegramUrl   === "string" ? b.telegramUrl   : undefined;
  const whitepaperUrl = typeof b.whitepaperUrl === "string" ? b.whitepaperUrl : undefined;
  const projectName   = typeof b.projectName   === "string" ? b.projectName   : undefined;
  const tokenMint     = typeof b.tokenMint     === "string" ? b.tokenMint     : undefined;

  if (!websiteUrl && !tokenMint && !projectName) {
    return NextResponse.json(
      { error: "At least one of websiteUrl, tokenMint, or projectName is required" },
      { status: 400 },
    );
  }

  const result = await computeOffChainCredibility({
    websiteUrl,
    githubUrl,
    twitterHandle,
    telegramUrl,
    whitepaperUrl,
    projectName,
    tokenMint,
  });

  return NextResponse.json(result);
}
