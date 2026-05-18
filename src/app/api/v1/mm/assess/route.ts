// ─── POST /api/v1/mm/assess (spec §10.1) — Phase 8 updated ───────────────
// Returns an MmRiskAssessment for a given (subjectType, subjectId, chain).
//
// Default behaviour: cache-only (reads MmScore). When cache is empty the
// endpoint returns 404 with a `lastSeenAt` hint.
//
// Phase 8 addition: `options.forceCompute = true` + ADMIN_TOKEN triggers a
// fresh on-chain scan via the data layer and returns the result. This path
// is deliberately admin-only because fresh scans cost API credits.

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
import { scanToken, scanWallet } from "@/lib/mm/data/scanner";

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

function authLevel(req: NextRequest): "admin" | "api" | "none" {
  const token = req.headers.get("x-api-token") ?? "";
  if (!token) return "none";
  const received = Buffer.from(token, "utf8");
  const adminToken = process.env.ADMIN_TOKEN;
  if (adminToken) {
    const adminBuf = Buffer.from(adminToken, "utf8");
    if (
      adminBuf.length === received.length &&
      timingSafeEqual(received, adminBuf)
    ) {
      return "admin";
    }
  }
  const apiToken = process.env.MM_API_TOKEN;
  if (apiToken) {
    const apiBuf = Buffer.from(apiToken, "utf8");
    if (
      apiBuf.length === received.length &&
      timingSafeEqual(received, apiBuf)
    ) {
      return "api";
    }
  }
  return "none";
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
      forceCompute: optionsIn.forceCompute === true,
    } as AssessInput["options"] & { forceCompute?: boolean },
  };
}

export async function POST(req: NextRequest) {
  const level = authLevel(req);
  if (level === "none") {
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

  const opts = (parsed.options ?? {}) as AssessInput["options"] & {
    forceCompute?: boolean;
  };

  // Phase 8: forceCompute is admin-only and bypasses the cache with a fresh
  // on-chain scan via the data layer.
  if (opts.forceCompute === true) {
    if (level !== "admin") {
      return NextResponse.json(
        { error: "forbidden_force_compute", message: "admin token required for forceCompute" },
        { status: 403 },
      );
    }
    try {
      if (parsed.subjectType === "WALLET") {
        await scanWallet(parsed.subjectId, parsed.chain, {
          triggeredBy: "API_ADMIN",
          triggeredByRef: "assess:forceCompute",
        });
      } else if (parsed.subjectType === "TOKEN") {
        await scanToken(parsed.subjectId, parsed.chain, {
          triggeredBy: "API_ADMIN",
          triggeredByRef: "assess:forceCompute",
        });
      }
      const freshAssessment = await computeMmRiskAssessment({
        subjectType: parsed.subjectType,
        subjectId: parsed.subjectId,
        chain: parsed.chain,
        useCache: true,
        maxAgeHours: 1,
        persist: false,
        triggeredBy: "API_ADMIN",
      });
      const projected = projectForMode(freshAssessment, opts.mode ?? "expanded", {
        includeDetectorBreakdown: opts.includeDetectorBreakdown,
        includeSignals: opts.includeSignals,
      });
      return NextResponse.json(projected);
    } catch (err) {
      console.error("[mm/assess] forceCompute failed", err);
      return NextResponse.json(
        {
          error: "force_compute_failed",
          message: err instanceof Error ? err.message : String(err),
        },
        { status: 500 },
      );
    }
  }

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
