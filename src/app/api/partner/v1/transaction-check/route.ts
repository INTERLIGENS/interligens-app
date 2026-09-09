import { NextRequest, NextResponse } from "next/server";
import { validatePartnerKey, unauthorizedPartnerResponse } from "@/lib/security/partnerAuth";
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { computeTigerScoreWithIntel, type TigerInput } from "@/lib/tigerscore/engine";
import { computeTigerScoreFromScan } from "@/lib/tigerscore/adapter";
import { isValidMint, isValidEvmAddress } from "@/lib/publicScore/schema";
import { readIntelligenceCoverage } from "@/lib/intelligence/sanctionCoverage";
import { canonicalPreBuyDecision, type ManqueMesure } from "@/lib/prebuy/canonicalDecision";
import { resolveTokenIdentity, type IdentityAttestation } from "@/lib/prebuy/identity";
import {
  probeCanonicalTokenIdentity,
  PREBUY_EVM_CHAINS,
} from "@/lib/prebuy/canonicalTokenIdentity";
import {
  projectPreBuy,
  toPartnerVerdict,
  toPartnerRecommendation,
  buildPartnerReason,
  type PreBuyProjection,
} from "@/lib/prebuy/projection";
import { isKnownBadEvm } from "@/lib/entities/knownBad";
import { loadCaseByMint } from "@/lib/caseDb";
import { getMarketSnapshot } from "@/lib/marketProviders";

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

// ─── BUILD 12 · S2 — DEUX DÉFAUTS FERMÉS ICI ──────────────────────────────
//
// Ce qu'il y avait :
//
//   function toVerdict(score)        { ... if (score >= 35) return "WARNING"; }
//   function toRecommendation(score) { ... if (score >= 40) return "WARN"; }
//
// Deux dérivations indépendantes du même score, avec deux bornes différentes.
// Dans la bande 35–39, UNE SEULE réponse portait `verdict_to: "WARNING"` ET
// `recommendation: "ALLOW"` : le verdict et l'action divergeaient à
// l'intérieur d'un même objet. Elles dérivent maintenant toutes deux de la
// MÊME projection, donc la divergence n'est plus corrigée — elle est devenue
// inexprimable.
//
//   function buildReason(score, signalsCount)
//
// La phrase « no critical risk signals detected » était construite sur le seul
// score, sans aucun état de mesure. C'était le défaut fermé côté
// /api/v1/score, resté ouvert côté partenaire. Même traitement.
//
// Le domaine de valeurs ne bouge pas — `SAFE` reste. Ce qui change est QUAND
// il sort : uniquement sur une projection ALLOW, donc adossée à une mesure
// attendue réussie et à une identité résolue.

// ── Score helper ──────────────────────────────────────────────────────────────

async function scoreAddress(
  address: string,
  chain: TigerInput["chain"]
): Promise<{
  score: number;
  verdict: Verdict;
  signals_count: number;
  projection: PreBuyProjection;
} | null> {
  try {
    const isEvm = isValidEvmAddress(address);
    const normalized = isEvm ? address.toLowerCase() : address;
    const knownBad = isEvm ? isKnownBadEvm(normalized) : null;

    if (!isEvm) {
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

      const finalScore = Math.max(tigerScan.score, intel.finalScore);
      const solManquants: ManqueMesure[] = market.data_unavailable
        ? [{ engine: "market", reason: "FAILURE" }]
        : [];
      const solAttest: IdentityAttestation[] = [
        { source: "casefile", attests: caseFile != null },
        { source: "market_pair", attests: !market.data_unavailable && Boolean(market.url) },
        { source: "intelligence_match", attests: intel.intelligence != null },
      ];
      const projection = projectPreBuy(
        canonicalPreBuyDecision({
          score: finalScore,
          measurement: {
            expected: 2,
            expectedMeasured: 2 - solManquants.length,
            missing: solManquants,
          },
          identity: resolveTokenIdentity({
            syntacticallyValid: true,
            attestations: solAttest,
          }),
        }),
      );
      return {
        score: finalScore,
        verdict: toPartnerVerdict(projection),
        signals_count:
          tigerScan.drivers.length +
          intel.drivers.filter((d) => d.id === "intelligence_overlay").length,
        projection,
      };
    }

    const input: TigerInput = {
      chain,
      evm_known_bad: knownBad !== null,
      evm_is_contract: false,
    };
    const intel = await Promise.race([
      computeTigerScoreWithIntel(input, normalized),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 10_000)
      ),
    ]);

    // AL — l'identité canonique, sondée. Le fail-closed est DANS l'adaptateur :
    // une panne provider ne remonte pas, elle produit une non-attestation.
    const canonique = await probeCanonicalTokenIdentity({
      address: normalized,
      chainHint: "ETH",
      allowedChains: PREBUY_EVM_CHAINS,
    });
    const evmProjection = projectPreBuy(
      canonicalPreBuyDecision({
        score: intel.finalScore,
        measurement: {
          expected: 1,
          expectedMeasured: 1,
          missing: [{ engine: "market", reason: "NOT_REQUESTED_BY_CONTRACT" }],
        },
        identity: resolveTokenIdentity({
          syntacticallyValid: true,
          attestations: [
            { source: "knownBad", attests: knownBad !== null },
            { source: "intelligence_match", attests: intel.intelligence != null },
            { source: "canonical_token_resolution", attests: canonique.attested },
          ],
        }),
      }),
    );
    return {
      score: intel.finalScore,
      verdict: toPartnerVerdict(evmProjection),
      signals_count: intel.drivers.length,
      projection: evmProjection,
    };
  } catch {
    return null;
  }
}

// ── POST handler ──────────────────────────────────────────────────────────────

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

  // Une seule source pour l'action, le verdict et la phrase.
  // S3 — le contrat porte la couverture à côté de la recommandation.
  const intelligenceCoverage = await readIntelligenceCoverage();
  const recommendation: Recommendation = toPartnerRecommendation(resultTo.projection);
  const reason = buildPartnerReason(
    resultTo.projection,
    resultTo.score,
    resultTo.signals_count,
  );

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
      intelligence_coverage: intelligenceCoverage,
    },
    { status: 200, headers: CORS_HEADERS }
  );
}
