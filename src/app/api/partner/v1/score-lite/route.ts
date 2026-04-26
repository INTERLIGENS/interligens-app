import { NextRequest, NextResponse } from "next/server";
import { validatePartnerKey, unauthorizedPartnerResponse } from "@/lib/security/partnerAuth";
import { computeTigerScoreWithIntel } from "@/lib/tigerscore/engine";
import { isValidMint, isValidEvmAddress } from "@/lib/publicScore/schema";
import { isKnownBadEvm } from "@/lib/entities/knownBad";

// ── CORS ──────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "X-Partner-Key, Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// ── Rate limit (separate store from public API) ────────────────────────────

const WINDOW_MS = 60_000;
const MAX_REQ = 60;
const rlStore = new Map<string, number[]>();

function checkPartnerRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const ts = (rlStore.get(ip) ?? []).filter((t) => t > cutoff);
  const allowed = ts.length < MAX_REQ;
  if (allowed) ts.push(now);
  ts.length > 0 ? rlStore.set(ip, ts) : rlStore.delete(ip);
  return { allowed, remaining: Math.max(0, MAX_REQ - ts.length) };
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

  // Rate limit
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkPartnerRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limit_exceeded", retry_after: 60 },
      { status: 429, headers: { ...CORS_HEADERS, "X-RateLimit-Remaining": "0" } }
    );
  }

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

  // Score with 10s timeout
  try {
    const normalized = isEvm ? address.toLowerCase() : address;
    const knownBad = isEvm ? isKnownBadEvm(normalized) : null;

    const intel = await Promise.race([
      computeTigerScoreWithIntel(
        isEvm
          ? { chain: "ETH", evm_known_bad: knownBad !== null, evm_is_contract: false }
          : { chain: "SOL", scan_type: "token" },
        normalized
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 10_000)
      ),
    ]);

    const score = intel.finalScore;
    const payload: PartnerScoreLiteResponse = {
      address: normalized,
      score,
      verdict: toVerdict(score),
      tier: toTier(score),
      signals_count: intel.drivers.length,
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
