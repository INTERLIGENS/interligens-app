import { checkRateLimit, rateLimitResponse, getClientIp, detectLocale, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { NextRequest, NextResponse } from "next/server";

import { vaultLookup } from "@/lib/vault/vaultLookup";
import { checkScanLimit } from "@/lib/vault/scanRateLimit";
import { auditScanLookup } from "@/lib/vault/auditScan";

const BSCSCAN_KEY = process.env.BSCSCAN_API_KEY ?? "";

async function bscScanGet(module: string, action: string, address: string, extra = "") {
  const url = `https://api.etherscan.io/v2/api?chainid=56&module=${module}&action=${action}&address=${address}&apikey=${BSCSCAN_KEY}${extra}`;
  const res = await fetch(url, { cache: "no-store" });
  return res.json();
}

export async function GET(req: NextRequest) {
  const _rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!_rl.allowed) return rateLimitResponse(_rl, detectLocale(req));

  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  const deep    = req.nextUrl.searchParams.get("deep") === "true";

  if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) {

    return NextResponse.json({ error: "Invalid BSC address" }, { status: 400 });
  }

  if (!BSCSCAN_KEY) {
    return NextResponse.json({
      chain: "bsc", address, score: 30, tier: "GREEN",
      proofs: [
        { label: "Network",  value: "BNB Smart Chain", level: "low",    riskDescription: "Official BSC mainnet" },
        { label: "Mode",     value: "Demo stable",     level: "low",    riskDescription: "Add BSCSCAN_API_KEY for live data" },
        { label: "Contract", value: "Not checked",     level: "medium", riskDescription: "Deep scan unavailable without API key" },
      ],
      rawSummary: { mode: "demo-stable", deep },
    });
  }

  try {
    const [txData, srcData] = await Promise.all([
      bscScanGet("account", "txlist", address, "&startblock=0&endblock=99999999&page=1&offset=10&sort=desc"),
      bscScanGet("contract", "getsourcecode", address),
    ]);

    const txList = Array.isArray(txData?.result) ? txData.result : [];
    const src    = Array.isArray(srcData?.result) ? srcData.result[0] : {};
    const now    = Date.now() / 1000;
    const recent = txList.filter((tx: any) => now - Number(tx.timeStamp) < 86400).length;
    const isVerified  = !!(src?.SourceCode);
    const contractAge = txList.length > 0 ? Math.floor((now - Number(txList[txList.length - 1].timeStamp)) / 86400) : null;

    let score = 20;
    if (!isVerified) score += 35;
    if (recent > 20) score += 15;
    if (contractAge !== null && contractAge < 7) score += 25;
    score = Math.min(score, 100);


    let intelVault = { match: false, categories: [] as string[], explainAvailable: false };
    try { const { vaultLookup } = await import("@/lib/vault/vaultLookup"); const _vr = await vaultLookup("bsc", address); intelVault = { ..._vr, explainAvailable: _vr.match }; } catch {}
    const tier = score > 70 ? "RED" : score > 30 ? "ORANGE" : "GREEN";

    return NextResponse.json({
      chain: "bsc", address, score, tier,
      proofs: [
        { label: "Contract",     value: isVerified ? "Verified" : "Unverified",  level: isVerified ? "low" : "high",    riskDescription: isVerified ? "Source code public on BscScan" : "Unverified contract" },
        { label: "Activity",     value: `${recent} TXs (24h)`,                  level: recent > 20 ? "medium" : "low", riskDescription: recent > 20 ? "High activity pattern" : "Normal activity" },
        { label: "Contract age", value: contractAge !== null ? `${contractAge}d` : "Unknown", level: contractAge !== null && contractAge < 7 ? "high" : "low", riskDescription: contractAge !== null && contractAge < 7 ? "Very new contract" : "Established contract" },
      ],
      rawSummary: { mode: "live-bscscan", deep, txCount: txList.length, verified: isVerified },
      intelVault,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "BSC scan failed", detail: String(err?.message) }, { status: 500 });
  }
}
