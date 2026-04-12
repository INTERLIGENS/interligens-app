import { checkRateLimit, rateLimitResponse, getClientIp, detectLocale, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { NextRequest, NextResponse } from "next/server";
import { isEVMAddress, computeArbitrumScore, type EVMScanResult, type EVMSignal } from "@/lib/evm/scorer";
import { vaultLookup } from "@/lib/vault/vaultLookup";

// ── Mock data for demo ───────────────────────────────────────────────────────

const MOCK_ARB_RED: EVMScanResult = {
  score: 91,
  tier: "RED",
  signals: [
    { kind: "BRIDGE_EXPLOIT_PATTERN", label: "Bridge exploit function calls detected", severity: "CRITICAL", delta: 35 },
    { kind: "KNOWN_BAD_DEPLOYER", label: "Deployer address flagged in known-bad database", severity: "CRITICAL", delta: 45 },
    { kind: "NO_VERIFIED_SOURCE", label: "Contract source code not verified on explorer", severity: "MEDIUM", delta: 15 },
  ],
  fallback: false,
  data_source: "etherscan-v2-arbitrum",
  isContract: true,
  txCount: 8,
  verified: false,
  contractAge: 2,
};

const MOCK_ARB_GREEN: EVMScanResult = {
  score: 18,
  tier: "GREEN",
  signals: [
    { kind: "LOW_HISTORY", label: "Very low transaction history", severity: "MEDIUM", delta: 10 },
  ],
  fallback: false,
  data_source: "etherscan-v2-arbitrum",
  isContract: false,
  txCount: 4,
  verified: false,
  contractAge: null,
};

const MOCK_RED_ADDR = "ARB_DEMO_ADDRESS_RED_0000000000000000000";
const MOCK_GREEN_ADDR = "ARB_DEMO_ADDRESS_GRN_0000000000000000000";

// ── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const _rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!_rl.allowed) return rateLimitResponse(_rl, detectLocale(req));

  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();
  const mock = searchParams.get("mock") || "";

  // Mock support
  if (mock === "arbitrum-red" || address === MOCK_RED_ADDR) {
    return buildResponse(MOCK_RED_ADDR, MOCK_ARB_RED, null);
  }
  if (mock === "arbitrum-green" || address === MOCK_GREEN_ADDR) {
    return buildResponse(MOCK_GREEN_ADDR, MOCK_ARB_GREEN, null);
  }

  if (!address) {
    return NextResponse.json({ error: "Missing ?address= parameter" }, { status: 400 });
  }

  if (!isEVMAddress(address)) {
    return NextResponse.json(
      { error: "Invalid Arbitrum address. Expected 0x followed by 40 hex characters." },
      { status: 400 }
    );
  }

  try {
    const result = await computeArbitrumScore(address);

    // Intel vault lookup
    let intelVault = { match: false, categories: [] as string[], explainAvailable: false };
    try {
      const _vr = await vaultLookup("arbitrum", address);
      intelVault = { ..._vr, explainAvailable: _vr.match };
    } catch {}

    return buildResponse(address, result, intelVault);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Arbitrum scan failed", detail: String(err?.message ?? "unknown") },
      { status: 500 }
    );
  }
}

function buildResponse(
  address: string,
  result: EVMScanResult,
  intelVault: { match: boolean; categories: string[]; explainAvailable: boolean } | null
) {
  const proofs = result.signals.slice(0, 3).map((s: EVMSignal) => ({
    label: s.kind.replace(/_/g, " "),
    value: s.label,
    level: s.severity === "CRITICAL" ? "red" : s.severity === "HIGH" ? "orange" : "low",
    riskDescription: s.label,
  }));

  while (proofs.length < 3) {
    proofs.push({
      label: "Network",
      value: "Arbitrum One",
      level: "low",
      riskDescription: "Arbitrum L2 via Etherscan v2",
    });
  }

  return NextResponse.json({
    chain: "arbitrum",
    address,
    score: result.score,
    tier: result.tier,
    signals: result.signals,
    is_contract: result.isContract,
    verified: result.verified,
    contract_age: result.contractAge,
    fallback: result.fallback,
    data_source: result.data_source,
    tx_count: result.txCount,
    cached: false,
    proofs,
    rawSummary: {
      mode: result.fallback ? "fallback" : "live-etherscan-v2",
      data_source: result.data_source,
      tx_count: result.txCount,
      verified: result.verified,
      contract_age: result.contractAge,
    },
    ...(intelVault ? { intelVault } : {}),
  });
}
