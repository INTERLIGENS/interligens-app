import { NextRequest, NextResponse } from "next/server";
import { validatePartnerKey, unauthorizedPartnerResponse } from "@/lib/security/partnerAuth";
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { computeTigerScoreWithIntel } from "@/lib/tigerscore/engine";
import { computeTigerScoreFromScan } from "@/lib/tigerscore/adapter";
import { isValidMint, isValidEvmAddress } from "@/lib/publicScore/schema";
import { readIntelligenceCoverage, type IntelligenceCoverage } from "@/lib/intelligence/sanctionCoverage";
import { canonicalPreBuyDecision, type ManqueMesure } from "@/lib/prebuy/canonicalDecision";
import { resolveTokenIdentity, type IdentityAttestation } from "@/lib/prebuy/identity";
import {
  probeCanonicalTokenIdentity,
  PREBUY_EVM_CHAINS,
} from "@/lib/prebuy/canonicalTokenIdentity";
import { projectPreBuy, toPartnerVerdict, toSwapTier } from "@/lib/prebuy/projection";
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

// ─── BUILD 12 · S2 — `SAFE` reste, sa CONDITION change ────────────────────
//
// Les deux tables de seuils qui vivaient ici étaient la troisième et la
// quatrième copie de la même règle. Elles sont supprimées : le verdict et le
// tier dérivent tous deux de la projection canonique.
//
// Le domaine de valeurs est INCHANGÉ — `SAFE` en fait toujours partie, et le
// retirer casserait des partenaires. Ce qui change est QUAND il sort : plus
// jamais sur le seul score, seulement sur une projection ALLOW.

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
  /** BUILD 12 · S3 — la couverture, à côté du verdict. Champ ADDITIF. */
  intelligence_coverage?: IntelligenceCoverage;
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
    let manquants: ManqueMesure[] = [];
    let attendus = 1;
    let attestations: IdentityAttestation[] = [];

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
      manquants = [{ engine: "market", reason: "NOT_REQUESTED_BY_CONTRACT" }];
      // AL — l'identité canonique, sondée. Le fail-closed est DANS l'adaptateur :
      // une panne provider ne remonte pas, elle produit une non-attestation.
      const canonique = await probeCanonicalTokenIdentity({
        address: normalized,
        chainHint: "ETH",
        allowedChains: PREBUY_EVM_CHAINS,
      });
      attestations = [
        { source: "knownBad", attests: knownBad !== null },
        { source: "intelligence_match", attests: intel.intelligence != null },
        { source: "canonical_token_resolution", attests: canonique.attested },
      ];
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
      attendus = 2;
      manquants = market.data_unavailable
        ? [{ engine: "market", reason: "FAILURE" }]
        : [];
      attestations = [
        { source: "casefile", attests: caseFile != null },
        { source: "market_pair", attests: !market.data_unavailable && Boolean(market.url) },
        { source: "intelligence_match", attests: intel.intelligence != null },
      ];
    }

    const projection = projectPreBuy(
      canonicalPreBuyDecision({
        score,
        measurement: {
          expected: attendus,
          expectedMeasured: attendus - manquants.filter((m) => m.reason === "FAILURE").length,
          missing: manquants,
        },
        identity: resolveTokenIdentity({ syntacticallyValid: true, attestations }),
      }),
    );

    // S3 — le contrat porte la couverture.
    const intelligenceCoverage = await readIntelligenceCoverage();
    const payload: PartnerScoreLiteResponse = {
      address: normalized,
      score,
      verdict: toPartnerVerdict(projection, intelligenceCoverage),
      tier: toSwapTier(projection),
      signals_count: signalsCount,
      cache_hit: false,
      as_of: new Date().toISOString(),
      version: "v1",
      powered_by: "INTERLIGENS",
      intelligence_coverage: intelligenceCoverage,
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
