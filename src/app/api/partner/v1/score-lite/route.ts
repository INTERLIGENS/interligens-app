import { NextRequest, NextResponse } from "next/server";
import { validatePartnerKey, unauthorizedPartnerResponse } from "@/lib/security/partnerAuth";
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { computeTigerScoreWithIntel } from "@/lib/tigerscore/engine";
import { computeTigerScoreFromScan } from "@/lib/tigerscore/adapter";
import { isValidMint, isValidEvmAddress } from "@/lib/publicScore/schema";
import { isKnownBadEvm } from "@/lib/entities/knownBad";
import { loadCaseByMint } from "@/lib/caseDb";
import { getMarketSnapshot } from "@/lib/marketProviders";

// ── CORS ──────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "X-Partner-Key, Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// ── Result cache (TTL 5 min) ───────────────────────────────────────────────

type CachedResult = { payload: PartnerScoreLiteResponse; expiresAt: number };
const resultCache = new Map<string, CachedResult>();

function getCached(address: string): PartnerScoreLiteResponse | null {
  const entry = resultCache.get(address);
  if (!entry || Date.now() > entry.expiresAt) {
    resultCache.delete(address);
    return null;
  }
  return { ...entry.payload, cache_hit: true };
}

function setCached(address: string, payload: PartnerScoreLiteResponse): void {
  resultCache.set(address, { payload, expiresAt: Date.now() + 5 * 60_000 });
}

// ── Verdict / tier mapping ─────────────────────────────────────────────────

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

type PartnerScoreLiteResponse = {
  address: string;
  score: number;
  verdict: Verdict;
  tier: Tier;
  signals_count: number;
  cache_hit: boolean;
  as_of: string;
  version: "v1";
  powered_by: "INTERLIGENS";
};

// ── GET handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth
  const valid = await validatePartnerKey(req);
  if (!valid) return unauthorizedPartnerResponse();

  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.partner);
  if (!rl.allowed) return rateLimitResponse(rl);

  // Validate address
  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (!address) {
    return NextResponse.json(
      { error: "bad_request", message: "Missing required query param: address" },
      { status: 400, headers: CORS_HEADERS }
    );
  }
  const isEvm = isValidEvmAddress(address);
  const isSol = isValidMint(address);
  if (!isEvm && !isSol) {
    return NextResponse.json(
      { error: "bad_request", message: "Invalid address format (EVM 0x or Solana base58 expected)" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Cache lookup
  const cached = getCached(address);
  if (cached) {
    return NextResponse.json(cached, {
      status: 200,
      headers: { ...CORS_HEADERS, "X-RateLimit-Remaining": String(rl.remaining) },
    });
  }

  try {
    const normalized = isEvm ? address.toLowerCase() : address;
    const knownBad = isEvm ? isKnownBadEvm(normalized) : null;

    let score: number;
    let signalsCount: number;

    if (isEvm) {
      const intel = await Promise.race([
        computeTigerScoreWithIntel(
          { chain: "ETH", evm_known_bad: knownBad !== null, evm_is_contract: false },
          normalized
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 10_000)
        ),
      ]);
      score = intel.finalScore;
      signalsCount = intel.drivers.length;
    } else {
      // SOL: full enrichment — same pipeline as /api/v1/score
      const caseFile = loadCaseByMint(normalized);
      const [market, intel] = await Promise.race([
        Promise.all([
          getMarketSnapshot("solana", normalized),
          computeTigerScoreWithIntel(
            { chain: "SOL", scan_type: "token", no_casefile: !caseFile, mint_address: normalized },
            normalized
          ),
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 10_000)
        ),
      ]);

      const rawClaims = caseFile?.claims ?? [];
      const tigerScan = computeTigerScoreFromScan({
        chain: "SOL",
        scan_type: "token",
        no_casefile: !caseFile,
        mint_address: normalized,
        market_url: market.url,
        pair_age_days: market.pair_age_days,
        liquidity_usd: market.liquidity_usd,
        fdv_usd: market.fdv_usd,
        volume_24h_usd: market.volume_24h_usd,
        scam_lineage: "NONE",
        signals: {
          confirmedCriticalClaims: rawClaims.filter(
            (cl) =>
              cl.severity === "CRITICAL" &&
              (cl.status === "CONFIRMED" || cl.status === "DISPUTED")
          ).length,
          knownBadAddresses: 0,
        },
      });

      score = Math.max(tigerScan.score, intel.finalScore);
      signalsCount =
        tigerScan.drivers.length +
        intel.drivers.filter((d) => d.id === "intelligence_overlay").length;
    }

    const payload: PartnerScoreLiteResponse = {
      address: normalized,
      score,
      verdict: toVerdict(score),
      tier: toTier(score),
      signals_count: signalsCount,
      cache_hit: false,
      as_of: new Date().toISOString(),
      version: "v1",
      powered_by: "INTERLIGENS",
    };

    setCached(address, payload);

    console.info(
      "[partner/score-lite] address=%s score=%d verdict=%s",
      normalized, score, payload.verdict
    );

    return NextResponse.json(payload, {
      status: 200,
      headers: { ...CORS_HEADERS, "X-RateLimit-Remaining": String(rl.remaining) },
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === "timeout";
    console.error("[partner/score-lite] error:", err);
    return NextResponse.json(
      { error: isTimeout ? "timeout" : "internal_error" },
      {
        status: isTimeout ? 504 : 500,
        headers: CORS_HEADERS,
      }
    );
  }
}
