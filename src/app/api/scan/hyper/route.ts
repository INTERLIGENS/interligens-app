import { NextRequest, NextResponse } from "next/server";

import { vaultLookup } from "@/lib/vault/vaultLookup";
import { checkScanLimit } from "@/lib/vault/scanRateLimit";
import { auditScanLookup } from "@/lib/vault/auditScan";

const HYPER_API_KEY = process.env.HYPER_API_KEY ?? "";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  const deep    = req.nextUrl.searchParams.get("deep") === "true";

  if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) {
  // ── Intel Vault lookup (non-breaking) ────────────────────────────────────────
  let intelVault: {
    match: boolean;
    categories: string[];
    topLabel?: string;
    confidence?: string;
    severity?: string;
    explainAvailable: boolean;
  } = { match: false, categories: [], explainAvailable: false };
  try {
    const _vaultChain   = String(chain).toLowerCase();
    const _vaultAddress = String(address).trim();
    if (_vaultAddress) {
      const _ip  = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      const _rl  = checkScanLimit(_ip);
      if (!_rl.allowed) {
        return NextResponse.json({
      intelVault, error: "Too many requests" }, { status: 429 });
      }
      const _vr = await vaultLookup(_vaultChain, _vaultAddress);
      await auditScanLookup({
        address: _vaultAddress, chain: _vaultChain,
        match: _vr.match, categoriesCount: _vr.categories.length,
      });
      const _adminHeader = req.headers.get("x-admin-token");
      const _isAdmin = !!(_adminHeader && _adminHeader === process.env.ADMIN_TOKEN);
      intelVault = {
        match:       _vr.match,
        categories:  _vr.categories,
        ...(_vr.topLabel   ? { topLabel:   _vr.topLabel   } : {}),
        ...(_vr.confidence ? { confidence: _vr.confidence } : {}),
        ...(_vr.severity   ? { severity:   _vr.severity   } : {}),
        explainAvailable: _vr.match && _isAdmin,
      };
    }
  } catch { /* vault non-blocking */ }
  // ─────────────────────────────────────────────────────────────────────────────

    return NextResponse.json({ error: "Invalid HyperEVM address. Must be 0x + 40 hex chars." }, { status: 400 });
  }

  // V1 stable — no key needed
  if (!HYPER_API_KEY) {
    return NextResponse.json({
      chain: "hyper",
      address,
      score: 25,
      tier: "GREEN",
      proofs: [
        { label: "Network",  value: "HyperEVM Mainnet", level: "low",    riskDescription: "Official Hyperliquid EVM chain" },
        { label: "Mode",     value: "Demo stable",      level: "low",    riskDescription: "Add HYPER_API_KEY for live data" },
        { label: "Activity", value: "Not checked",      level: "medium", riskDescription: "Live scan unavailable without API key" },
      ],
      rawSummary: { mode: "demo-stable", note: "HyperEVM demo", deep },
    });
  }

  // V1.5 pro — with key (Hyperliquid public API)
  try {
    const infoRes = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "clearinghouseState", user: address }),
      cache: "no-store",
    });
    const info = await infoRes.json();

    const positions   = Array.isArray(info?.assetPositions) ? info.assetPositions : [];
    const hasActivity = positions.length > 0;
    const totalValue  = positions.reduce((acc: number, p: any) => acc + Math.abs(Number(p?.position?.szi ?? 0)), 0);

    let score = 15;
    if (!hasActivity)      score += 10;
    if (totalValue > 1000) score += 10;
    score = Math.min(score, 100);

    const tier = score > 70 ? "RED" : score > 30 ? "ORANGE" : "GREEN";

    return NextResponse.json({
      chain: "hyper",
      address,
      score,
      tier,
      proofs: [
        { label: "Network",   value: "HyperEVM Mainnet",          level: "low",    riskDescription: "Official Hyperliquid EVM chain" },
        { label: "Positions", value: `${positions.length} open`,  level: positions.length > 10 ? "medium" : "low", riskDescription: positions.length > 10 ? "High number of open positions" : "Normal activity" },
        { label: "Exposure",  value: totalValue > 0 ? `$${totalValue.toFixed(0)} notional` : "No open positions", level: totalValue > 10000 ? "high" : "low", riskDescription: totalValue > 10000 ? "High notional exposure" : "Low exposure" },
      ],
      rawSummary: { mode: "live-hyper", deep, positionCount: positions.length, totalValue },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Hyper scan failed", detail: String(err?.message) }, { status: 500 });
  }
}
