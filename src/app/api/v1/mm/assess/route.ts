// ─── POST /api/v1/mm/assess (spec §10.1) ──────────────────────────────────
// Returns an MmRiskAssessment for a given (subjectType, subjectId, chain).
//
// Phase 5 constraint: the endpoint has no on-chain data layer yet. If a
// cached MmScore is available and usable (fresh enough) it is returned.
// Otherwise the endpoint replies 404 "no cached assessment available — run
// a scan first" — the data layer lands in Phase 6+.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/security/rateLimit";
import { computeMmRiskAssessment, projectForMode } from "@/lib/mm/adapter/riskAssessment";
import type { AssessInput, AssessMode } from "@/lib/mm/adapter/types";
import type { MmChain, MmSubjectType } from "@/lib/mm/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const RATE_LIMIT = {
  windowMs: 60 * 1_000,
  max: 10,
  keyPrefix: "rl:mm:assess",
};

const VALID_SUBJECT_TYPES: MmSubjectType[] = ["WALLET", "TOKEN", "ENTITY"];
const VALID_CHAINS: MmChain[] = [
  "SOLANA",
  "ETHEREUM",
  "BASE",
  "ARBITRUM",
  "OPTIMISM",
  "BNB",
  "POLYGON",
];
const VALID_MODES: AssessMode[] = ["summary", "expanded", "full"];

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

function authorise(req: NextRequest): boolean {
  const token = req.headers.get("x-api-token") ?? "";
  const candidates = [process.env.MM_API_TOKEN, process.env.ADMIN_TOKEN].filter(
    (t): t is string => typeof t === "string" && t.length > 0,
  );
  if (candidates.length === 0) return false;
  const received = Buffer.from(token, "utf8");
  return candidates.some((expected) => {
    const expBuf = Buffer.from(expected, "utf8");
    if (expBuf.length !== received.length) return false;
    return timingSafeEqual(received, expBuf);
  });
}

function parseBody(body: unknown): AssessInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "invalid_body" };
  const b = body as Record<string, unknown>;
  const subjectType = b.subjectType as MmSubjectType;
  const subjectId = b.subjectId;
  const chain = b.chain as MmChain;
  if (!subjectType || !VALID_SUBJECT_TYPES.includes(subjectType)) {
    return { error: "invalid_subject_type" };
  }
  if (typeof subjectId !== "string" || !subjectId.trim()) {
    return { error: "invalid_subject_id" };
  }
  if (!chain || !VALID_CHAINS.includes(chain)) return { error: "invalid_chain" };

  const optionsIn = (b.options ?? {}) as Record<string, unknown>;
  const mode = (optionsIn.mode as AssessMode | undefined) ?? "expanded";
  if (!VALID_MODES.includes(mode)) return { error: "invalid_mode" };

  return {
    subjectType,
    subjectId: subjectId.trim(),
    chain,
    options: {
      useCache: optionsIn.useCache === false ? false : true,
      maxAgeHours:
        typeof optionsIn.maxAgeHours === "number" ? optionsIn.maxAgeHours : 6,
      includeDetectorBreakdown: optionsIn.includeDetectorBreakdown === true,
      includeSignals: optionsIn.includeSignals === true,
      mode,
    },
  };
}

export async function POST(req: NextRequest) {
  if (!authorise(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl);

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return badRequest("invalid_json");
  }

  const parsed = parseBody(rawBody);
  if ("error" in parsed) return badRequest(parsed.error);

  const opts = parsed.options ?? {};

  // Attempt a cache-only lookup. Phase 5 exposes no on-chain data layer, so
  // the endpoint can only serve cached assessments.
  if (opts.useCache !== false) {
    try {
      const cached = await computeMmRiskAssessment({
        subjectType: parsed.subjectType,
        subjectId: parsed.subjectId,
        chain: parsed.chain,
        useCache: true,
        maxAgeHours: opts.maxAgeHours,
        // When no engine inputs are provided AND no cache exists, we'd end
        // up returning an all-zero assessment. We only want cache hits here.
        persist: false,
      });
      if (cached.source === "cache") {
        const projected = projectForMode(cached, opts.mode ?? "expanded", {
          includeDetectorBreakdown: opts.includeDetectorBreakdown,
          includeSignals: opts.includeSignals,
        });
        return NextResponse.json(projected);
      }
    } catch (err) {
      // Fall through to the 404 response below.
      console.error("[mm/assess] cache lookup failed", err);
    }
  }

  // For ENTITY subjects we can still serve a registry-only assessment even
  // without cached data, because the data is entirely Registry-side.
  if (parsed.subjectType === "ENTITY") {
    try {
      const result = await computeMmRiskAssessment({
        subjectType: parsed.subjectType,
        subjectId: parsed.subjectId,
        chain: parsed.chain,
        useCache: false,
        persist: true,
        triggeredBy: "API_PUBLIC",
      });
      const projected = projectForMode(result, opts.mode ?? "expanded", {
        includeDetectorBreakdown: opts.includeDetectorBreakdown,
        includeSignals: opts.includeSignals,
      });
      return NextResponse.json(projected);
    } catch (err) {
      console.error("[mm/assess] entity assessment failed", err);
      return NextResponse.json({ error: "assess_failed" }, { status: 500 });
    }
  }

  // Confirm the subject has at least been seen before (useful error copy).
  const seen = await prisma.mmScore.findFirst({
    where: {
      subjectType: parsed.subjectType,
      subjectId: parsed.subjectId,
      chain: parsed.chain,
    },
    select: { computedAt: true },
  });

  return NextResponse.json(
    {
      error: "no_cached_assessment",
      message:
        "no cached assessment available — run a scan first (data layer lands in Phase 6+).",
      lastSeenAt: seen?.computedAt ?? null,
    },
    { status: 404 },
  );
}
