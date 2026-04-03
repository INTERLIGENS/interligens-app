// ─────────────────────────────────────────────────────────────────────────────
// Public API — Case Intelligence lookup for scanner badge
// Rate-limited. Only returns RETAIL_SAFE entities.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  detectLocale,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";
import { lookupValue, matchEntity } from "@/lib/intelligence";
import { prisma } from "@/lib/prisma";
import { normalizeValue, buildDedupKey } from "@/lib/intelligence/normalize";
import type { IntelEntityType } from "@/lib/intelligence";

async function handleLookup(req: Request, value: string, type?: string, chain?: string) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!rl.allowed) return rateLimitResponse(rl, detectLocale(req));

  if (!value) {
    return NextResponse.json({ error: "Missing value" }, { status: 400 });
  }

  const signal = type
    ? await matchEntity({ type: type as IntelEntityType, value, chain })
    : await lookupValue(value, chain);

  // Enforce displaySafety gate for public route
  if (signal.matchCount > 0) {
    const types = ["ADDRESS", "CONTRACT", "TOKEN_CA", "DOMAIN", "PROJECT"] as const;
    let isRetailSafe = false;

    for (const t of types) {
      const normalized = normalizeValue(t, value);
      const dedupKey = buildDedupKey(t, normalized);
      const entity = await prisma.canonicalEntity.findUnique({
        where: { dedupKey },
        select: { displaySafety: true },
      });
      if (entity?.displaySafety === "RETAIL_SAFE") {
        isRetailSafe = true;
        break;
      }
    }

    if (!isRetailSafe) {
      return NextResponse.json({
        match: false,
        ims: 0,
        ics: 0,
        matchCount: 0,
        hasSanction: false,
      });
    }
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
  return handleLookup(req, value, undefined, chain);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const value = (body.value || "").trim();
  const type = body.type || undefined;
  const chain = body.chain || undefined;
  return handleLookup(req, value, type, chain);
}
