/**
 * POST /api/mobile/v1/scan
 *
 * Mobile-facing endpoint — returns TigerScore for a given address.
 * Auth: X-Mobile-Api-Token header (MOBILE_API_TOKEN env var).
 * Body: { address: string, chain?: "SOL" | "ETH" | "BSC" | "TRON" | "HYPER" }
 * Response: { score, tier, riskLevel, drivers, confidence, scannedAt }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  detectLocale,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";
import { computeTigerScoreFromScan } from "@/lib/tigerscore/adapter";
import { computeTigerScore, type TigerInput } from "@/lib/tigerscore/engine";
import { rpcCall } from "@/lib/rpc";
import { loadCaseByMint } from "@/lib/caseDb";
import { getMarketSnapshot } from "@/lib/marketProviders";
import { isKnownBad } from "@/lib/entities/knownBad";

// ── Helpers ─────────────────────────────────────────────────────────────────

type Chain = TigerInput["chain"];

const TIER_TO_RISK: Record<string, "low" | "medium" | "high"> = {
  GREEN: "low",
  ORANGE: "medium",
  RED: "high",
};

function detectChain(address: string): Chain | null {
  if (/^0x[0-9a-fA-F]{40}$/.test(address)) return "ETH";
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return "TRON"; // TRON base58
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return "SOL";
  return null;
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Auth
  const mobileToken = request.headers.get("X-Mobile-Api-Token");
  if (!mobileToken || mobileToken !== process.env.MOBILE_API_TOKEN) {
    return NextResponse.json({ error: "Unauthorized. A valid API token is required." }, { status: 401 });
  }

  // 2. Rate limit
  const rl = await checkRateLimit(getClientIp(request), RATE_LIMIT_PRESETS.scan);
  if (!rl.allowed) return rateLimitResponse(rl, detectLocale(request));

  // 3. Parse body
  let body: { address?: string; chain?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const address = body.address?.trim();
  if (!address || address.length < 20 || address.length > 64) {
    return NextResponse.json(
      { error: "Missing or invalid `address` field (20-64 chars)" },
      { status: 400 },
    );
  }

  // 4. Resolve chain
  const chain: Chain | null =
    (body.chain?.toUpperCase() as Chain) || detectChain(address);

  if (!chain || !["SOL", "ETH", "BSC", "TRON", "HYPER"].includes(chain)) {
    return NextResponse.json(
      { error: "Cannot determine chain. Provide `chain` field (SOL | ETH | BSC | TRON | HYPER)." },
      { status: 400 },
    );
  }

  // 5. Build signals & compute TigerScore
  try {
    const tiger =
      chain === "SOL" || chain === "ETH"
        ? await computeFromAdapter(chain, address, request)
        : await computeFromEngine(chain, address);

    return NextResponse.json({
      address,
      chain,
      score: tiger.score,
      tier: tiger.tier,
      riskLevel: TIER_TO_RISK[tiger.tier],
      drivers: tiger.drivers,
      confidence: tiger.confidence,
      scannedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(`[mobile/scan] chain=${chain} address=${address} error=`, err?.message);
    return NextResponse.json(
      { error: "Scan failed", detail: String(err?.message).slice(0, 200) },
      { status: 502 },
    );
  }
}

// ── Signal builder per chain ────────────────────────────────────────────────

async function computeFromAdapter(
  chain: "SOL" | "ETH",
  address: string,
  request: NextRequest,
) {
  if (chain === "SOL") return computeSolViaAdapter(address, request);
  return computeEthViaAdapter(address);
}

async function computeSolViaAdapter(
  address: string,
  request: NextRequest,
) {
  let rpcFallbackUsed = false;
  let rpcDown = false;
  let rpcError: string | null = null;
  let rpcSourceDetail: string | null = null;
  let rpcDataSource: "rpc_primary" | "rpc_fallback" | "unknown" = "unknown";

  try {
    const res = await rpcCall("SOL", "getAccountInfo", [address, { encoding: "base64" }]);
    rpcFallbackUsed = res.didFallback;
    rpcSourceDetail = res.provider_used;
    rpcDataSource = res.didFallback ? "rpc_fallback" : "rpc_primary";
  } catch (e: any) {
    rpcDown = true;
    rpcError = String(e?.message || "SOL RPC unavailable").slice(0, 120);
  }

  const caseFile = loadCaseByMint(address);
  const marketSnapshot = await getMarketSnapshot("solana", address);

  // Lineage graph (best-effort)
  let scamLineage: "CONFIRMED" | "REFERENCED" | "NONE" = "NONE";
  try {
    const graphUrl = new URL(`/api/scan/solana/graph?mint=${address}`, request.url);
    const graphRes = await fetch(graphUrl.toString(), { signal: AbortSignal.timeout(8000) });
    if (graphRes.ok) {
      const g = await graphRes.json();
      if (g?.overall_status === "CONFIRMED") scamLineage = "CONFIRMED";
      else if (g?.overall_status === "REFERENCED") scamLineage = "REFERENCED";
    }
  } catch { /* fail-open */ }

  const rawClaims = caseFile?.claims ?? [];

  return computeTigerScoreFromScan({
    chain: "SOL",
    rpc_fallback_used: rpcFallbackUsed,
    rpc_down: rpcDown,
    rpc_error: rpcError,
    data_source: rpcDataSource,
    source_detail: rpcSourceDetail,
    scan_type: "token",
    no_casefile: !caseFile,
    mint_address: address,
    market_url: marketSnapshot.url,
    pair_age_days: marketSnapshot.pair_age_days,
    liquidity_usd: marketSnapshot.liquidity_usd,
    fdv_usd: marketSnapshot.fdv_usd,
    volume_24h_usd: marketSnapshot.volume_24h_usd,
    scam_lineage: scamLineage,
    signals: {
      confirmedCriticalClaims: rawClaims.filter(
        (cl) =>
          cl.severity === "CRITICAL" &&
          (cl.status === "CONFIRMED" || (cl.status as string) === "REFERENCED"),
      ).length,
      knownBadAddresses: 0,
    },
  });
}

async function computeEthViaAdapter(address: string) {
  // knownBad → instant RED
  const badHit = isKnownBad("ETH", address);
  if (badHit) {
    return {
      score: 100,
      tier: "RED" as const,
      drivers: [{
        id: "known_bad_address",
        label: badHit.label,
        severity: "critical" as const,
        delta: 100,
        why: `Address flagged as ${badHit.category} (confidence: ${badHit.confidence})`,
      }],
      confidence: "High" as const,
    };
  }

  let rpcFallbackUsed = false;
  let rpcDown = false;
  let rpcError: string | null = null;
  let rpcDataSource: "rpc_primary" | "rpc_fallback" | "unknown" = "unknown";
  let isContract = false;

  try {
    const res = await rpcCall("ETH", "eth_getCode", [address, "latest"]);
    rpcFallbackUsed = res.didFallback;
    rpcDataSource = res.didFallback ? "rpc_fallback" : "rpc_primary";
    // EOA returns "0x", contracts return bytecode
    const code = res.result?.result ?? res.result ?? "0x";
    isContract = typeof code === "string" && code.length > 2;
  } catch (e: any) {
    rpcDown = true;
    rpcError = String(e?.message || "ETH RPC unavailable").slice(0, 120);
  }

  // EOA wallet — skip market data, boost signals from case registry
  if (!isContract) {
    const caseFile = loadCaseByMint(address);
    const rawClaims = caseFile?.claims ?? [];

    return computeTigerScoreFromScan({
      chain: "ETH",
      rpc_fallback_used: rpcFallbackUsed,
      rpc_down: rpcDown,
      rpc_error: rpcError,
      data_source: rpcDataSource,
      signals: {
        confirmedCriticalClaims: rawClaims.filter(
          (cl) =>
            cl.severity === "CRITICAL" &&
            (cl.status === "CONFIRMED" || (cl.status as string) === "REFERENCED"),
        ).length,
        knownBadAddresses: 0,
      },
    });
  }

  // Contract — full scan
  return computeTigerScoreFromScan({
    chain: "ETH",
    is_contract: true,
    rpc_fallback_used: rpcFallbackUsed,
    rpc_down: rpcDown,
    rpc_error: rpcError,
    data_source: rpcDataSource,
    signals: {},
  });
}

async function computeFromEngine(chain: Chain, _address: string) {
  // TRON/HYPER/BSC — no adapter support yet, use engine directly
  return computeTigerScore({ chain });
}
