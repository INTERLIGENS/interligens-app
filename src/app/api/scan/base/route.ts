import { checkRateLimit, rateLimitResponse, getClientIp, detectLocale, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { NextRequest, NextResponse } from "next/server";
import { isEVMAddress, computeBaseScore, type EVMScanResult, type EVMSignal } from "@/lib/evm/scorer";
import { vaultLookup } from "@/lib/vault/vaultLookup";

// ── Mock data for demo ───────────────────────────────────────────────────────

const MOCK_BASE_RED: EVMScanResult = {
  score: 82,
  tier: "RED",
  signals: [
    { kind: "HONEYPOT_PATTERN", label: "Honeypot token detected — 0% sell tax enforced", severity: "CRITICAL", delta: 40 },
    { kind: "NO_VERIFIED_SOURCE", label: "Contract source code not verified on explorer", severity: "MEDIUM", delta: 15 },
    { kind: "FRESH_CONTRACT", label: "Contract created less than 7 days ago", severity: "HIGH", delta: 20 },
  ],
  fallback: false,
  data_source: "etherscan-v2-base",
  isContract: true,
  txCount: 12,
  verified: false,
  contractAge: 3,
};

const MOCK_BASE_GREEN: EVMScanResult = {
  score: 14,
  tier: "GREEN",
  signals: [
    { kind: "LOW_HISTORY", label: "Very low transaction history", severity: "MEDIUM", delta: 10 },
  ],
  fallback: false,
  data_source: "etherscan-v2-base",
  isContract: false,
  txCount: 3,
  verified: false,
  contractAge: null,
};

const MOCK_RED_ADDR = "BASE_DEMO_ADDRESS_RED_000000000000000000";
const MOCK_GREEN_ADDR = "BASE_DEMO_ADDRESS_GRN_000000000000000000";

// ── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const _rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!_rl.allowed) return rateLimitResponse(_rl, detectLocale(req));

  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();
  const mock = searchParams.get("mock") || "";

  // Mock support
  if (mock === "base-red" || address === MOCK_RED_ADDR) {
    return buildResponse(MOCK_RED_ADDR, MOCK_BASE_RED, null);
  }
  if (mock === "base-green" || address === MOCK_GREEN_ADDR) {
    return buildResponse(MOCK_GREEN_ADDR, MOCK_BASE_GREEN, null);
  }

  if (!address) {
    return NextResponse.json({ error: "Missing ?address= parameter" }, { status: 400 });
  }

  if (!isEVMAddress(address)) {
    return NextResponse.json(
      { error: "Invalid Base address. Expected 0x followed by 40 hex characters." },
      { status: 400 }
    );
  }

  try {
    const result = await computeBaseScore(address);

    // Intel vault lookup
    let intelVault = { match: false, categories: [] as string[], explainAvailable: false };
    try {
      const _vr = await vaultLookup("base", address);
      intelVault = { ..._vr, explainAvailable: _vr.match };
    } catch {}

    return buildResponse(address, result, intelVault);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Base scan failed", detail: String(err?.message ?? "unknown") },
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
      value: "Base Mainnet",
      level: "low",
      riskDescription: "Coinbase L2 via Etherscan v2",
    });
  }

  return NextResponse.json({
    chain: "base",
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
