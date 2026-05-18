// ─── GET /api/mobile/v1/mm/entities ───────────────────────────────────────
// Mobile-facing MM registry listing. Auth: X-Mobile-Api-Token header.
// Returns the published registry slice — what the mobile app is allowed to
// surface as a browsable index. DRAFT / REVIEWED / UNPUBLISHED entities are
// always filtered out (no admin override on the mobile side).
//
//   Query:
//     status?  — MmStatus filter (optional)
//     limit?   — 1..100 (default 50)
//     offset?  — ≥ 0    (default 0)

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
import type { MmStatus } from "@/lib/mm/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUS: MmStatus[] = [
  "CONVICTED",
  "CHARGED",
  "SETTLED",
  "INVESTIGATED",
  "DOCUMENTED",
  "OBSERVED",
];

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

function clampInt(raw: string | null, fallback: number, min: number, max: number) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

export async function GET(req: NextRequest) {
  if (!mobileTokenMatches(req.headers.get("X-Mobile-Api-Token"))) {
    return NextResponse.json(
      { error: "Unauthorized. A valid API token is required." },
      { status: 401 },
    );
  }

  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!rl.allowed) return rateLimitResponse(rl, detectLocale(req));

  const url = new URL(req.url);
  const statusRaw = (url.searchParams.get("status") ?? "").toUpperCase();
  const statusFilter =
    statusRaw && VALID_STATUS.includes(statusRaw as MmStatus)
      ? (statusRaw as MmStatus)
      : null;

  const limit = clampInt(url.searchParams.get("limit"), 50, 1, 100);
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, 10_000);

  try {
    const where = {
      workflow: { in: ["PUBLISHED" as const, "CHALLENGED" as const] },
      ...(statusFilter ? { status: statusFilter } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.mmEntity.findMany({
        where,
        select: {
          slug: true,
          name: true,
          legalName: true,
          status: true,
          riskBand: true,
          defaultScore: true,
          publicSummary: true,
          publicSummaryFr: true,
          updatedAt: true,
          workflow: true,
        },
        orderBy: [{ status: "asc" }, { name: "asc" }],
        skip: offset,
        take: limit,
      }),
      prisma.mmEntity.count({ where }),
    ]);

    return NextResponse.json({
      total,
      limit,
      offset,
      entities: rows.map((e) => ({
        slug: e.slug,
        name: e.name,
        legalName: e.legalName,
        status: e.status,
        riskBand: e.riskBand,
        defaultScore: e.defaultScore,
        summary: e.publicSummaryFr || e.publicSummary,
        updatedAt: e.updatedAt.toISOString(),
        workflow: e.workflow,
      })),
    });
  } catch (err) {
    console.error("[mobile/mm/entities] lookup failed", err);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
}
