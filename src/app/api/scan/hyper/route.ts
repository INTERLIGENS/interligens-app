import { NextRequest, NextResponse } from "next/server";

const HYPER_API_KEY = process.env.HYPER_API_KEY ?? "";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  const deep    = req.nextUrl.searchParams.get("deep") === "true";

  if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) {
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
