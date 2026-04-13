import { checkRateLimit, rateLimitResponse, getClientIp, detectLocale, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { NextRequest, NextResponse } from "next/server";
import { isTronAddress } from "@/lib/tron/rpc";
import { computeTronWalletScore, computeTronTokenScore } from "@/lib/tron/scorer";
import type { TronScanResult, TronSignal } from "@/lib/tron/scorer";
import { vaultLookup } from "@/lib/vault/vaultLookup";

// ── Mock data for demo ───────────────────────────────────────────────────────

const MOCK_TRON_RED: TronScanResult = {
  score: 89,
  tier: "RED",
  signals: [
    { kind: "USDT_BLACKLISTED", label: "Address on USDT-TRC20 blacklist", severity: "CRITICAL", delta: 40 },
    { kind: "FROZEN_ACCOUNT", label: "Account has frozen resources", severity: "CRITICAL", delta: 35 },
    { kind: "NO_TRANSFER_HISTORY", label: "No transaction history found", severity: "MEDIUM", delta: 10 },
  ],
  isBlacklisted: false,
  usdtBlacklisted: true,
  fallback: false,
  data_source: "trongrid",
  isFrozen: true,
  txCount: 0,
  createTime: Date.now() - 2 * 24 * 60 * 60 * 1000,
};

const MOCK_TRON_GREEN: TronScanResult = {
  score: 12,
  tier: "GREEN",
  signals: [
    { kind: "LOW_HOLDER_COUNT", label: "Only 45 holders", severity: "MEDIUM", delta: 10 },
  ],
  isBlacklisted: false,
  usdtBlacklisted: false,
  fallback: false,
  data_source: "trongrid",
  isFrozen: false,
  txCount: 342,
  createTime: Date.now() - 180 * 24 * 60 * 60 * 1000,
};

const MOCK_RED_ADDR = "TRON_DEMO_ADDRESS_RED_000000000000";
const MOCK_GREEN_ADDR = "TRON_DEMO_ADDRESS_GRN_000000000000";

// ── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const _rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!_rl.allowed) return rateLimitResponse(_rl, detectLocale(req));

  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();
  const deep = searchParams.get("deep") === "true";
  const mock = searchParams.get("mock") || "";

  // Mock support
  if (mock === "tron-red" || address === MOCK_RED_ADDR) {
    return buildResponse(MOCK_RED_ADDR, MOCK_TRON_RED, null);
  }
  if (mock === "tron-green" || address === MOCK_GREEN_ADDR) {
    return buildResponse(MOCK_GREEN_ADDR, MOCK_TRON_GREEN, null);
  }

  if (!address) {
    return NextResponse.json({ error: "Missing ?address= parameter" }, { status: 400 });
  }

  if (!isTronAddress(address)) {
    return NextResponse.json(
      { error: "Invalid TRON address. Expected Base58 starting with T (34 characters)." },
      { status: 400 }
    );
  }

  try {
    // Score as wallet first (most common use case for TRON)
    const result = await computeTronWalletScore(address);

    // Intel vault lookup
    let intelVault = { match: false, categories: [] as string[], explainAvailable: false };
    try {
      const _vr = await vaultLookup("tron", address);
      intelVault = { ..._vr, explainAvailable: _vr.match };
    } catch {}

    return buildResponse(address, result, intelVault);
  } catch (err: any) {
    console.error("[scan/tron] Error:", err);
    return NextResponse.json(
      { error: "TRON scan failed", detail: String(err?.message ?? "unknown") },
      { status: 500 }
    );
  }
}

function buildResponse(
  address: string,
  result: TronScanResult,
  intelVault: { match: boolean; categories: string[]; explainAvailable: boolean } | null
) {
  const proofs = result.signals.slice(0, 3).map((s: TronSignal) => ({
    label: s.kind.replace(/_/g, " "),
    value: s.label,
    level: s.severity === "CRITICAL" ? "red" : s.severity === "HIGH" ? "orange" : "low",
    riskDescription: s.label,
  }));

  // Pad to 3 proofs for UI consistency
  while (proofs.length < 3) {
    proofs.push({
      label: "Network",
      value: "TRON Mainnet",
      level: "low",
      riskDescription: "Official TRON network via TronGrid",
    });
  }

  return NextResponse.json({
    chain: "tron",
    address,
    score: result.score,
    tier: result.tier,
    signals: result.signals,
    is_blacklisted: result.isBlacklisted,
    usdt_blacklisted: result.usdtBlacklisted,
    is_frozen: result.isFrozen,
    fallback: result.fallback,
    data_source: result.data_source,
    tx_count: result.txCount,
    cached: false,
    proofs,
    rawSummary: {
      mode: result.fallback ? "fallback" : "live-trongrid",
      data_source: result.data_source,
      tx_count: result.txCount,
      create_time: result.createTime,
      usdt_blacklisted: result.usdtBlacklisted,
      is_frozen: result.isFrozen,
    },
    ...(intelVault ? { intelVault } : {}),
  });
}
