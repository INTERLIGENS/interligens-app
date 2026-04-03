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
import { lookupValue } from "@/lib/intelligence";
import { prisma } from "@/lib/prisma";
import { normalizeValue, buildDedupKey } from "@/lib/intelligence/normalize";

export async function GET(req: Request) {
  const rl = await checkRateLimit(
    getClientIp(req),
    RATE_LIMIT_PRESETS.scan
  );
  if (!rl.allowed) return rateLimitResponse(rl, detectLocale(req));

  const url = new URL(req.url);
  const value = (url.searchParams.get("value") || "").trim();
  const chain = url.searchParams.get("chain") || undefined;

  if (!value) {
    return NextResponse.json({ error: "Missing value" }, { status: 400 });
  }

  const signal = await lookupValue(value, chain);

  // Enforce displaySafety gate for public route
  if (signal.matchCount > 0) {
    // Look up the entity to check displaySafety
    const types = ["ADDRESS", "CONTRACT", "TOKEN_CA", "DOMAIN", "PROJECT"] as const;
    let isRetailSafe = false;

    for (const type of types) {
      const normalized = normalizeValue(type, value);
      const dedupKey = buildDedupKey(type, normalized);
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
      // Entity exists but not cleared for retail — return empty signal
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
