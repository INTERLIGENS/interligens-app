import { NextRequest, NextResponse } from "next/server";
import { validatePartnerKey, unauthorizedPartnerResponse } from "@/lib/security/partnerAuth";
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { computeTigerScoreWithIntel, type TigerInput } from "@/lib/tigerscore/engine";
import { isValidMint, isValidEvmAddress } from "@/lib/publicScore/schema";
import { isKnownBadEvm } from "@/lib/entities/knownBad";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "X-Partner-Key, Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const MAX_ADDRESSES = 10;

type Verdict = "SAFE" | "WARNING" | "AVOID";
type Tier = "GREEN" | "ORANGE" | "RED";

function toVerdict(score: number): Verdict {
  if (score >= 70) return "AVOID";
  if (score >= 35) return "WARNING";
  return "SAFE";
}

function toTier(score: number): Tier {
  if (score >= 70) return "RED";
  if (score >= 35) return "ORANGE";
  return "GREEN";
}

type BatchResult =
  | { address: string; score: number; verdict: Verdict; tier: Tier }
  | { address: string; error: string };

async function scoreOne(address: string): Promise<BatchResult> {
  const isEvm = isValidEvmAddress(address);
  const isSol = isValidMint(address);

  if (!isEvm && !isSol) {
    return { address, error: "invalid_address" };
  }

  const normalized = isEvm ? address.toLowerCase() : address;
  const knownBad = isEvm ? isKnownBadEvm(normalized) : null;

  const input: TigerInput = isEvm
    ? { chain: "ETH", evm_known_bad: knownBad !== null, evm_is_contract: false }
    : { chain: "SOL", scan_type: "token" };

  try {
    const intel = await Promise.race([
      computeTigerScoreWithIntel(input, normalized),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 10_000)
      ),
    ]);

    return {
      address: normalized,
      score: intel.finalScore,
      verdict: toVerdict(intel.finalScore),
      tier: toTier(intel.finalScore),
    };
  } catch (err) {
    return {
      address: normalized,
      error: err instanceof Error && err.message === "timeout" ? "timeout" : "internal_error",
    };
  }
}

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.partner);
  if (!rl.allowed) return rateLimitResponse(rl);

  const valid = await validatePartnerKey(req);
  if (!valid) return unauthorizedPartnerResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "bad_request", message: "Body must be a JSON object" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const { addresses } = body as Record<string, unknown>;

  if (!Array.isArray(addresses)) {
    return NextResponse.json(
      { error: "bad_request", message: '"addresses" must be an array' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (addresses.length === 0) {
    return NextResponse.json(
      { error: "bad_request", message: '"addresses" must not be empty' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (addresses.length > MAX_ADDRESSES) {
    return NextResponse.json(
      { error: "bad_request", message: `Maximum ${MAX_ADDRESSES} addresses per request` },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (!addresses.every((a) => typeof a === "string")) {
    return NextResponse.json(
      { error: "bad_request", message: "All addresses must be strings" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const settled = await Promise.allSettled(
    (addresses as string[]).map((a) => scoreOne(a.trim()))
  );

  const results: BatchResult[] = settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { address: (addresses as string[])[i], error: "internal_error" }
  );

  const errors = results.filter((r) => "error" in r).length;

  console.info(
    "[partner/batch-score] processed=%d errors=%d",
    results.length, errors
  );

  return NextResponse.json(
    { results, processed: results.length, errors, version: "v1" },
    { status: 200, headers: CORS_HEADERS }
  );
}
