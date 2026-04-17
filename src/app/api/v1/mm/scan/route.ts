// ─── POST /api/v1/mm/scan (spec §10.5, beta-gated) ────────────────────────
// On-demand scan endpoint. Phase 5 stubs this out and returns 501 because
// the on-chain data layer (helius/birdeye/etherscan) lands in Phase 6+.
//
// Even as a stub the endpoint:
//   • authenticates the caller (X-Api-Token)
//   • requires an access code in the body
//   • rate-limits 5 req / day / access code
//   • logs the attempt into MmReviewLog with action=CREATED, targetType=SCAN_RUN

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/security/rateLimit";
import { writeReviewLog } from "@/lib/mm/registry/reviewLog";
import type { MmChain, MmSubjectType } from "@/lib/mm/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

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
  if (!body.subjectId || typeof body.subjectId !== "string") {
    return badRequest("invalid_subject_id");
  }
  if (!body.chain || !VALID_CHAINS.includes(body.chain)) {
    return badRequest("invalid_chain");
  }

  const rl = await checkRateLimit(`access:${body.accessCode}`, SCAN_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl);

  // Log the attempt so we can see demand even while the endpoint is stubbed.
  try {
    await writeReviewLog({
      targetType: "SCAN_RUN",
      targetId: `pending:${body.subjectType}:${body.subjectId}:${body.chain}`,
      action: "CREATED",
      actorUserId: body.accessCode,
      actorRole: "beta_user",
      notes: "scan endpoint invoked — data layer not available",
      snapshotAfter: {
        subjectType: body.subjectType,
        subjectId: body.subjectId,
        chain: body.chain,
        status: "STUB_501",
      },
    });
  } catch (err) {
    console.error("[mm/scan] reviewLog write failed", err);
  }

  return NextResponse.json(
    {
      error: "not_implemented",
      message: "scan endpoint requires data layer — available in Phase 6+",
      subject: {
        subjectType: body.subjectType,
        subjectId: body.subjectId,
        chain: body.chain,
      },
    },
    { status: 501 },
  );
}
