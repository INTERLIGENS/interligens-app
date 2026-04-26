import { NextRequest, NextResponse } from "next/server";
import { validatePartnerKey, unauthorizedPartnerResponse } from "@/lib/security/partnerAuth";
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

// ── Chain mapping ─────────────────────────────────────────────────────────────

type SupportedChain = "eth" | "sol" | "bsc" | "base" | "arb" | "tron";
const CHAIN_MAP: Record<SupportedChain, TigerInput["chain"]> = {
  eth:  "ETH",
  sol:  "SOL",
  bsc:  "BSC",
  base: "BASE",
  arb:  "ARBITRUM",
  tron: "TRON",
};
const SUPPORTED_CHAINS = Object.keys(CHAIN_MAP) as SupportedChain[];

// ── Verdict / recommendation ──────────────────────────────────────────────────

type Verdict = "SAFE" | "WARNING" | "AVOID";
type Recommendation = "ALLOW" | "WARN" | "BLOCK";

function toVerdict(score: number): Verdict {
  if (score >= 70) return "AVOID";
  if (score >= 35) return "WARNING";
  return "SAFE";
}

function toRecommendation(score: number): Recommendation {
  if (score >= 70) return "BLOCK";
  if (score >= 40) return "WARN";
  return "ALLOW";
}

function buildReason(score: number, signalsCount: number): string {
  const rec = toRecommendation(score);
  if (rec === "BLOCK")
    return `Score ${score}/100 — ${signalsCount} high-risk signal${signalsCount !== 1 ? "s" : ""} detected`;
  if (rec === "WARN")
    return `Score ${score}/100 — ${signalsCount} risk signal${signalsCount !== 1 ? "s" : ""} detected, proceed with caution`;
  return `Score ${score}/100 — no critical risk signals detected`;
}

// ── Score helper ──────────────────────────────────────────────────────────────

async function scoreAddress(
  address: string,
  chain: TigerInput["chain"]
): Promise<{ score: number; verdict: Verdict; signals_count: number } | null> {
  try {
    const isEvm = isValidEvmAddress(address);
    const normalized = isEvm ? address.toLowerCase() : address;
    const knownBad = isEvm ? isKnownBadEvm(normalized) : null;

    const input: TigerInput = isEvm
      ? { chain, evm_known_bad: knownBad !== null, evm_is_contract: false }
      : { chain, scan_type: "token" };

    const intel = await Promise.race([
      computeTigerScoreWithIntel(input, normalized),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 10_000)
      ),
    ]);

    return {
      score: intel.finalScore,
      verdict: toVerdict(intel.finalScore),
      signals_count: intel.drivers.length,
    };
  } catch {
    return null;
  }
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
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

  const { to, from, chain: chainRaw } = body as Record<string, unknown>;

  // Validate "to" (required)
  if (typeof to !== "string" || to.trim().length === 0) {
    return NextResponse.json(
      { error: "bad_request", message: 'Missing required field: "to"' },
      { status: 400, headers: CORS_HEADERS }
    );
  }
  const toAddr = to.trim();
  if (!isValidEvmAddress(toAddr) && !isValidMint(toAddr)) {
    return NextResponse.json(
      { error: "bad_request", message: '"to" must be a valid EVM or Solana address' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Validate "from" (optional)
  const fromAddr = typeof from === "string" ? from.trim() : null;
  if (fromAddr && !isValidEvmAddress(fromAddr) && !isValidMint(fromAddr)) {
    return NextResponse.json(
      { error: "bad_request", message: '"from" must be a valid EVM or Solana address' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Validate "chain" (optional, default eth)
  const chainKey = (typeof chainRaw === "string" ? chainRaw.toLowerCase() : "eth") as SupportedChain;
  if (!SUPPORTED_CHAINS.includes(chainKey)) {
    return NextResponse.json(
      { error: "bad_request", message: `Unsupported chain. Accepted: ${SUPPORTED_CHAINS.join(", ")}` },
      { status: 400, headers: CORS_HEADERS }
    );
  }
  const tigerChain = CHAIN_MAP[chainKey];

  // Score addresses in parallel
  const [resultTo, resultFrom] = await Promise.all([
    scoreAddress(toAddr, tigerChain),
    fromAddr ? scoreAddress(fromAddr, tigerChain) : Promise.resolve(null),
  ]);

  if (!resultTo) {
    return NextResponse.json(
      { error: "internal_error", message: "Failed to score target address" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const recommendation = toRecommendation(resultTo.score);
  const reason = buildReason(resultTo.score, resultTo.signals_count);

  console.info(
    "[partner/transaction-check] to=%s from=%s chain=%s score_to=%d recommendation=%s",
    toAddr, fromAddr ?? "—", chainKey, resultTo.score, recommendation
  );

  return NextResponse.json(
    {
      recommendation,
      reason,
      score_to: resultTo.score,
      score_from: resultFrom?.score ?? null,
      verdict_to: resultTo.verdict,
      chain: chainKey,
      version: "v1",
      powered_by: "INTERLIGENS",
    },
    { status: 200, headers: CORS_HEADERS }
  );
}
