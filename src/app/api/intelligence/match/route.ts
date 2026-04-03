// ─────────────────────────────────────────────────────────────────────────────
// Public API — Case Intelligence match (alias for /api/scan/intelligence)
// POST { type, value, chain? } → IntelSignal
// GET  ?value=&chain= → IntelSignal
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  detectLocale,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";
import { matchEntity, lookupValue } from "@/lib/intelligence";
import { prisma } from "@/lib/prisma";
import { normalizeValue, buildDedupKey } from "@/lib/intelligence/normalize";
import type { IntelEntityType } from "@/lib/intelligence";

async function isRetailSafe(value: string): Promise<boolean> {
  const types: IntelEntityType[] = ["ADDRESS", "CONTRACT", "TOKEN_CA", "DOMAIN", "PROJECT"];
  for (const type of types) {
    const normalized = normalizeValue(type, value);
    const dedupKey = buildDedupKey(type, normalized);
    const entity = await prisma.canonicalEntity.findUnique({
      where: { dedupKey },
      select: { displaySafety: true },
    });
    if (entity?.displaySafety === "RETAIL_SAFE") return true;
  }
  return false;
}

function emptySignal() {
  return NextResponse.json({
    match: false,
    ims: 0,
    ics: 0,
    matchCount: 0,
    hasSanction: false,
    topRiskClass: null,
    sourceSlug: null,
    externalUrl: null,
    matchBasis: null,
  });
}

async function handleLookup(value: string, type?: string, chain?: string, req?: Request) {
  const rl = await checkRateLimit(getClientIp(req!), RATE_LIMIT_PRESETS.scan);
  if (!rl.allowed) return rateLimitResponse(rl, detectLocale(req!));

  if (!value) return NextResponse.json({ error: "Missing value" }, { status: 400 });

  const signal = type
    ? await matchEntity({ type: type as IntelEntityType, value, chain })
    : await lookupValue(value, chain);

  if (signal.matchCount > 0 && !(await isRetailSafe(value))) {
    return emptySignal();
  }

  return NextResponse.json({
    match: signal.matchCount > 0,
    ims: signal.ims,
    ics: signal.ics,
    matchCount: signal.matchCount,
    hasSanction: signal.hasSanction,
    topRiskClass: signal.topRiskClass,
    sourceSlug: signal.sourceSlug,
    externalUrl: signal.externalUrl,
    matchBasis: signal.matchBasis,
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const value = (url.searchParams.get("value") || "").trim();
  const chain = url.searchParams.get("chain") || undefined;
  return handleLookup(value, undefined, chain, req);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const value = (body.value || "").trim();
  const type = body.type || undefined;
  const chain = body.chain || undefined;
  return handleLookup(value, type, chain, req);
}
