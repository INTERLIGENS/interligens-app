// ─── GET /api/v1/mm/public/badge ──────────────────────────────────────────
// Public, unauthenticated endpoint that returns a MINIMAL MM summary for a
// given (tokenAddress, chain). Designed for the INTERLIGENS Guard browser
// extension — mirrors /api/v1/score which Guard already hits without auth.
//
//   • Cache-only: reads MmScore and never triggers a fresh scan. If no
//     cache row exists or the stored score is older than 24 h → 404 (Guard
//     interprets this as "no badge to render").
//   • Rate-limited per IP (30 req/min — scan preset) to prevent abuse.
//   • Leaks nothing a visitor couldn't already find on /mm/[slug]:
//     displayScore, band, dominantDriver, disclaimer, entity.{slug,name,status}.

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
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

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!rl.allowed) return rateLimitResponse(rl);

  const url = new URL(req.url);
  const tokenAddress = url.searchParams.get("tokenAddress")?.trim() ?? "";
  const chainRaw = (url.searchParams.get("chain") ?? "").toUpperCase() as MmChain;
  const subjectType =
    (url.searchParams.get("subjectType") ?? "TOKEN").toUpperCase() as MmSubjectType;

  if (!tokenAddress) return badRequest("missing_tokenAddress");
  if (!VALID_CHAINS.includes(chainRaw)) return badRequest("invalid_chain");
  if (subjectType !== "TOKEN" && subjectType !== "WALLET") {
    return badRequest("invalid_subjectType");
  }

  try {
    const row = await prisma.mmScore.findUnique({
      where: {
        subjectType_subjectId_chain: {
          subjectType,
          subjectId: tokenAddress,
          chain: chainRaw,
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

    if (!row) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (Date.now() - row.computedAt.getTime() > MAX_AGE_MS) {
      return NextResponse.json({ error: "stale" }, { status: 404 });
    }

    const snapshot = (row.breakdown ?? null) as MmScoreSnapshot | null;
    const overall = snapshot?.overall ?? {};
    const entity = snapshot?.registry?.entity ?? null;

    return NextResponse.json({
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
    });
  } catch (err) {
    console.error("[mm/public/badge] lookup failed", err);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
}
