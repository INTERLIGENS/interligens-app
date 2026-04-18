// ─── POST /api/mobile/v1/mm/score ─────────────────────────────────────────
// Mobile-facing MM score lookup. Auth: X-Mobile-Api-Token header.
//
//   Body: { tokenAddress, chain, subjectType? = "TOKEN" }
//
// Returns the cached MmScore row + a minimal entity summary when one is
// attributed. Never triggers a fresh scan (cache-only — same contract as the
// Guard public badge endpoint). If no cache row exists or the stored score is
// older than 24 h, returns { mmRisk: null }. That lets the mobile client render
// a neutral state without branching on HTTP status codes.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
  detectLocale,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";
import type { MmChain, MmSubjectType } from "@/lib/mm/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CHAINS: MmChain[] = [
  "SOLANA",
  "ETHEREUM",
  "BASE",
  "ARBITRUM",
  "OPTIMISM",
  "BNB",
  "POLYGON",
];

const MAX_AGE_MS = 24 * 60 * 60 * 1_000;

function mobileTokenMatches(provided: string | null): boolean {
  const expected = process.env.MOBILE_API_TOKEN;
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return timingSafeEqual(a, b);
}

interface SnapshotOverall {
  displayScore?: number;
  band?: string;
  dominantDriver?: string;
  disclaimer?: string;
}

interface SnapshotRegistry {
  entity?: { slug?: string; name?: string; status?: string } | null;
}

interface MmScoreSnapshot {
  overall?: SnapshotOverall;
  registry?: SnapshotRegistry;
}

export async function POST(req: NextRequest) {
  if (!mobileTokenMatches(req.headers.get("X-Mobile-Api-Token"))) {
    return NextResponse.json(
      { error: "Unauthorized. A valid API token is required." },
      { status: 401 },
    );
  }

  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!rl.allowed) return rateLimitResponse(rl, detectLocale(req));

  let body: { tokenAddress?: string; chain?: string; subjectType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tokenAddress = body.tokenAddress?.trim();
  const chain = (body.chain ?? "").toUpperCase() as MmChain;
  const subjectType = (body.subjectType ?? "TOKEN").toUpperCase() as MmSubjectType;

  if (!tokenAddress) {
    return NextResponse.json({ error: "missing_tokenAddress" }, { status: 400 });
  }
  if (!VALID_CHAINS.includes(chain)) {
    return NextResponse.json({ error: "invalid_chain" }, { status: 400 });
  }
  if (subjectType !== "TOKEN" && subjectType !== "WALLET") {
    return NextResponse.json({ error: "invalid_subjectType" }, { status: 400 });
  }

  try {
    const row = await prisma.mmScore.findUnique({
      where: {
        subjectType_subjectId_chain: {
          subjectType,
          subjectId: tokenAddress,
          chain,
        },
      },
      select: {
        displayScore: true,
        band: true,
        dominantDriver: true,
        computedAt: true,
        breakdown: true,
      },
    });

    if (!row || Date.now() - row.computedAt.getTime() > MAX_AGE_MS) {
      return NextResponse.json({
        tokenAddress,
        chain,
        subjectType,
        mmRisk: null,
        scannedAt: new Date().toISOString(),
      });
    }

    const snapshot = (row.breakdown ?? null) as MmScoreSnapshot | null;
    const overall = snapshot?.overall ?? {};
    const entity = snapshot?.registry?.entity ?? null;

    return NextResponse.json({
      tokenAddress,
      chain,
      subjectType,
      mmRisk: {
        displayScore: row.displayScore,
        band: row.band,
        dominantDriver: row.dominantDriver,
        disclaimer: overall.disclaimer ?? null,
        entity: entity
          ? {
              slug: entity.slug ?? null,
              name: entity.name ?? null,
              status: entity.status ?? null,
            }
          : null,
        computedAt: row.computedAt.toISOString(),
      },
      scannedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[mobile/mm/score] lookup failed", err);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
}
