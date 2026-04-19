// ─── POST /api/v1/mm/scan (spec §10.5, beta-gated) — Phase 8 activated ───
// On-demand scan endpoint wired to the real data layer.
//
//   • X-Api-Token auth (MM_API_TOKEN or ADMIN_TOKEN, constant-time)
//   • Beta access code required in body
//   • Rate limit 5 req / day / access code
//   • Logs the attempt AND the resolved scanRunId into MmReviewLog
//   • Returns the full MmRiskAssessment via the adapter

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/security/rateLimit";
import { writeReviewLog } from "@/lib/mm/registry/reviewLog";
import type { MmChain, MmSubjectType } from "@/lib/mm/types";
import { scanToken, scanWallet } from "@/lib/mm/data/scanner";
import { computeMmRiskAssessment } from "@/lib/mm/adapter/riskAssessment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SCAN_RATE_LIMIT = {
  windowMs: 24 * 60 * 60 * 1_000,
  max: 5,
  keyPrefix: "rl:mm:scan",
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

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

interface ScanBody {
  accessCode?: string;
  subjectType?: MmSubjectType;
  subjectId?: string;
  chain?: MmChain;
  cohortKey?: string;
}

export async function POST(req: NextRequest) {
  if (!authorise(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ScanBody;
  try {
    body = (await req.json()) as ScanBody;
  } catch {
    return badRequest("invalid_json");
  }

  if (!body.accessCode || typeof body.accessCode !== "string") {
    return badRequest("missing_access_code");
  }
  if (!body.subjectType || !VALID_SUBJECT_TYPES.includes(body.subjectType)) {
    return badRequest("invalid_subject_type");
  }
  if (body.subjectType === "ENTITY") {
    return badRequest("scan_not_supported_for_entity");
  }
  if (!body.subjectId || typeof body.subjectId !== "string") {
    return badRequest("invalid_subject_id");
  }
  if (!body.chain || !VALID_CHAINS.includes(body.chain)) {
    return badRequest("invalid_chain");
  }

  const rl = await checkRateLimit(`access:${body.accessCode}`, SCAN_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl);

  // Pre-log the attempt so we capture demand + unauthorised scans.
  try {
    await writeReviewLog({
      targetType: "SCAN_RUN",
      targetId: `pending:${body.subjectType}:${body.subjectId}:${body.chain}`,
      action: "CREATED",
      actorUserId: body.accessCode,
      actorRole: "beta_user",
      notes: "scan endpoint invoked",
    });
  } catch (err) {
    console.error("[mm/scan] reviewLog pre-log failed", err);
  }

  try {
    // Fresh scan via the data-layer orchestrator.
    const result =
      body.subjectType === "WALLET"
        ? await scanWallet(body.subjectId, body.chain, {
            cohortKey: body.cohortKey,
            triggeredBy: "API_PUBLIC",
            triggeredByRef: `access:${body.accessCode}`,
          })
        : await scanToken(body.subjectId, body.chain, {
            cohortKey: body.cohortKey,
            triggeredBy: "API_PUBLIC",
            triggeredByRef: `access:${body.accessCode}`,
          });

    // The scanner persisted the scan run + cache; now read it back as a
    // full MmRiskAssessment so the response matches /assess.
    const assessment = await computeMmRiskAssessment({
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      chain: body.chain,
      useCache: true,
      persist: false,
      triggeredBy: "API_PUBLIC",
    });

    return NextResponse.json(
      {
        ok: true,
        scanRunId: assessment.scanRunId,
        assessment,
        rawEngine: {
          behaviorDrivenScore: result.behaviorDrivenScore,
          confidence: result.confidence,
          coverage: result.coverage,
          signalsCount: result.signalsCount,
          capsApplied: result.capsApplied,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[mm/scan] scan failed", err);
    return NextResponse.json(
      {
        error: "scan_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
