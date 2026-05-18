// src/app/api/v1/narrative/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateNarrative, type NarrativeInput } from "@/lib/narrative/generator";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY: Omit<import("@/lib/narrative/generator").NarrativeResult, "generated_at"> = {
  narrative_en: "",
  narrative_fr: "",
  confidence: "LOW",
  input_completeness: 0,
};

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ...EMPTY, generated_at: new Date(), error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ...EMPTY, generated_at: new Date(), error: "Body required" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  const input: NarrativeInput = {
    kolHandle:             typeof b.kolHandle             === "string"  ? b.kolHandle             : undefined,
    tokenSymbol:           typeof b.tokenSymbol           === "string"  ? b.tokenSymbol           : undefined,
    tokenMint:             typeof b.tokenMint             === "string"  ? b.tokenMint             : undefined,
    totalProceedsUsd:      typeof b.totalProceedsUsd      === "number"  ? b.totalProceedsUsd      : undefined,
    cashoutDestination:    typeof b.cashoutDestination    === "string"  ? b.cashoutDestination    : undefined,
    intermediateWallets:   typeof b.intermediateWallets   === "number"  ? b.intermediateWallets   : undefined,
    shillFollowers:        typeof b.shillFollowers        === "number"  ? b.shillFollowers        : undefined,
    priceDropPct:          typeof b.priceDropPct          === "number"  ? b.priceDropPct          : undefined,
    deltaHours:            typeof b.deltaHours            === "number"  ? b.deltaHours            : undefined,
    chain:                 typeof b.chain                 === "string"  ? b.chain                 : undefined,
  };

  try {
    const result = await generateNarrative(input);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ...EMPTY, generated_at: new Date() });
  }
}
